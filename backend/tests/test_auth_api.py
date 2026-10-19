from sqlalchemy import select

from app.models import User
from tests.conftest import GUEST


def test_signup_sets_cookie_and_me(client):
    res = client.post("/api/auth/signup", json=GUEST)
    assert res.status_code == 201
    assert res.json()["email"] == GUEST["email"]
    assert res.json()["role"] == "USER"
    assert "haru_session" in res.cookies
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "김하루"


def test_signup_duplicate_email_409(client):
    client.post("/api/auth/signup", json=GUEST)
    res = client.post("/api/auth/signup", json=GUEST)
    assert res.status_code == 409
    assert res.json()["detail"] == "EMAIL_TAKEN"


def test_login_wrong_password_401(client):
    client.post("/api/auth/signup", json=GUEST)
    res = client.post("/api/auth/login", json={"email": GUEST["email"], "password": "wrong-password"})
    assert res.status_code == 401
    assert res.json()["detail"] == "INVALID_CREDENTIALS"


def test_logout_clears_session(user_client):
    assert user_client.post("/api/auth/logout").status_code == 204
    assert user_client.get("/api/auth/me").status_code == 401


def test_password_is_hashed(user_client, db):
    user = db.scalar(select(User).where(User.email == GUEST["email"]))
    assert user.password_hash != GUEST["password"]
    assert len(user.password_hash) > 20


def test_tampered_token_401(client):
    client.cookies.set("haru_session", "not-a-real-token")
    assert client.get("/api/auth/me").status_code == 401


def test_me_without_cookie_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_concurrent_duplicate_signup_is_409_not_500(make_client):
    from concurrent.futures import ThreadPoolExecutor
    clients = [make_client() for _ in range(4)]
    with ThreadPoolExecutor(4) as pool:
        codes = sorted(pool.map(lambda c: c.post("/api/auth/signup", json=GUEST).status_code, clients))
    assert codes == [201, 409, 409, 409]


def test_password_hashing_runs_without_holding_a_db_connection(client, monkeypatch):
    """argon2 is deliberately slow; doing it while a pooled connection is checked out starves the pool in a burst."""
    from app.api import auth as auth_api
    from app.core.db import engine
    seen = []
    real_hash, real_verify = auth_api.hash_password, auth_api.verify_password
    monkeypatch.setattr(auth_api, "hash_password", lambda pw: (seen.append(engine.pool.checkedout()), real_hash(pw))[1])
    monkeypatch.setattr(auth_api, "verify_password", lambda pw, h: (seen.append(engine.pool.checkedout()), real_verify(pw, h))[1])
    assert client.post("/api/auth/signup", json=GUEST).status_code == 201
    assert client.post("/api/auth/login", json={"email": GUEST["email"], "password": GUEST["password"]}).status_code == 200
    assert seen == [0, 0]
