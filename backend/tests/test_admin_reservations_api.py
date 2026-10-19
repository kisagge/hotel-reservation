from datetime import date

from app.core.clock import kst
from tests.conftest import book

D = lambda day: date(2026, 10, day)


def seed_mixed(db):
    book(db, kst(D(23), 10), kst(D(23), 14), kst(D(23), 15), guest_name="이서연")
    book(db, kst(D(24), 15), kst(D(25), 11), kst(D(25), 12), type="STAY", nights=1, price=89000, guest_name="박준호")
    book(db, kst(D(27)), kst(D(29)), kst(D(29)), type="BLOCK", price=0, guest_name="", block_reason="정기 점검")


def test_admin_routes_forbidden_for_user(user_client, client):
    for path in ["/api/admin/reservations", "/api/admin/dashboard"]:
        assert user_client.get(path).status_code == 403
        assert client.get(path).status_code == 401


def test_list_filters_by_type_and_q(admin_client, db):
    seed_mixed(db)
    assert admin_client.get("/api/admin/reservations").json()["total"] == 2
    stays = admin_client.get("/api/admin/reservations", params={"type": "STAY"}).json()
    assert [i["guest_name"] for i in stays["items"]] == ["박준호"]
    found = admin_client.get("/api/admin/reservations", params={"q": "이서"}).json()
    assert found["total"] == 1 and found["items"][0]["guest_name"] == "이서연"
    ranged = admin_client.get("/api/admin/reservations", params={"date_from": "2026-10-24", "date_to": "2026-10-31"}).json()
    assert [i["guest_name"] for i in ranged["items"]] == ["박준호"]


def test_list_excludes_blocks(admin_client, db):
    seed_mixed(db)
    items = admin_client.get("/api/admin/reservations").json()["items"]
    assert all(i["type"] != "BLOCK" for i in items)


def test_list_pagination(admin_client, db):
    for day in range(20, 26):
        book(db, kst(D(day), 15), kst(D(day), 19), kst(D(day), 20))
    page2 = admin_client.get("/api/admin/reservations", params={"page": 2, "size": 4}).json()
    assert page2["total"] == 6 and len(page2["items"]) == 2 and page2["page"] == 2


def test_detail_includes_payment_and_email(admin_client, user_client):
    rid = user_client.post("/api/reservations", json={"type": "DAYUSE", "date": "2026-10-23", "start_hour": 15,
                                                       "guest_name": "김하루", "guest_phone": "010-1234-5678"}).json()["id"]
    body = admin_client.get(f"/api/admin/reservations/{rid}").json()
    assert body["user_email"] == "guest@example.com"
    assert body["payment"]["status"] == "PAID" and body["payment"]["amount"] == 35000


def test_admin_cancel_anytime_before_start(admin_client, db, clock):
    r = book(db, kst(D(19), 12), kst(D(19), 16), kst(D(19), 17))  # starts in 3h; guest deadline long gone
    res = admin_client.post(f"/api/admin/reservations/{r.id}/cancel")
    assert res.status_code == 200 and res.json()["status"] == "CANCELLED"
    r2 = book(db, kst(D(20), 12), kst(D(20), 16), kst(D(20), 17))
    clock.set(kst(D(20), 13))
    res = admin_client.post(f"/api/admin/reservations/{r2.id}/cancel")
    assert res.status_code == 409 and res.json()["detail"] == "CANCEL_DEADLINE_PASSED"


def test_dashboard_counts(admin_client, db):
    book(db, kst(D(18), 15), kst(D(19), 11), kst(D(19), 12), type="STAY", nights=1, price=79000, guest_name="김민수")
    book(db, kst(D(19), 12), kst(D(19), 16), kst(D(19), 17), guest_name="이서연")
    book(db, kst(D(23), 10), kst(D(23), 14), kst(D(23), 15))
    book(db, kst(D(23), 15), kst(D(25), 11), kst(D(25), 12), type="STAY", nights=2, price=178000)
    book(db, kst(D(24), 15), kst(D(25), 11), kst(D(25), 12), status="CANCELLED", type="STAY", price=89000)
    d = admin_client.get("/api/admin/dashboard").json()
    assert d["today_check_ins"] == 1
    assert d["today_check_outs"] == 1
    assert d["week_reservations"] == 3
    assert d["month_revenue"] == 79000 + 35000 + 35000 + 178000
    assert [t["guest_name"] for t in d["today_timeline"]] == ["김민수", "이서연"]
    assert len(d["upcoming"]) == 3


def test_list_order_is_stable_on_equal_start(admin_client, db):
    a = book(db, kst(D(23), 15), kst(D(23), 19), kst(D(23), 20), status="CANCELLED", guest_name="A")
    b = book(db, kst(D(23), 15), kst(D(23), 19), kst(D(23), 20), guest_name="B")
    ids = [i["id"] for i in admin_client.get("/api/admin/reservations").json()["items"]]
    assert ids == sorted([a.id, b.id])


def test_search_treats_wildcards_literally(admin_client, db):
    seed_mixed(db)
    assert admin_client.get("/api/admin/reservations", params={"q": "%"}).json()["total"] == 0
    assert admin_client.get("/api/admin/reservations", params={"q": "_"}).json()["total"] == 0
