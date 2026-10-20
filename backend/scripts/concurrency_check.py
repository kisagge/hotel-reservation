"""Multi-server concurrency check for HARU bookings.

Fires simultaneous requests from many signed-in users spread across several API servers that share one
PostgreSQL database, then verifies invariants directly in the database:

  * no two CONFIRMED rows overlap (including the cleaning buffer)
  * every booking has exactly one payment; CONFIRMED → PAID, CANCELLED → REFUNDED
  * every HTTP 201 corresponds to a stored reservation
  * no 5xx responses

Usage (servers must point at a disposable database, with HARU_RATE_LIMIT_ENABLED=false so the hundreds of
signups/logins from one machine are not throttled by the auth rate limits):
  uv run python scripts/concurrency_check.py --bases http://localhost:8201,http://localhost:8202 \
      --db postgresql://haru:haru@localhost:5433/haru_load --users 40
"""

import argparse
import asyncio
import random
import statistics
import sys
import time
from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import psycopg

KST = ZoneInfo("Asia/Seoul")
ADMIN = {"email": "admin@haru.dev", "password": "admin1234"}


class Run:
    def __init__(self) -> None:
        self.statuses: Counter[int] = Counter()
        self.latencies: list[float] = []
        self.created: set[int] = set()
        self.failures: list[str] = []

    async def call(self, client: httpx.AsyncClient, method: str, url: str, **kw) -> httpx.Response:
        t = time.perf_counter()
        try:
            res = await client.request(method, url, **kw)
        except httpx.TransportError as e:  # dropped/refused connection: count it, keep going
            self.statuses[599] += 1
            self.failures.append(f"{method} {url} → transport error {type(e).__name__}")
            return httpx.Response(599, json={"detail": "TRANSPORT_ERROR"})
        self.latencies.append(time.perf_counter() - t)
        self.statuses[res.status_code] += 1
        if res.status_code >= 500:
            self.failures.append(f"{method} {url} → {res.status_code} {res.text[:200]}")
        if res.status_code == 201 and url == "/api/reservations":
            self.created.add(res.json()["id"])
        return res

    def check(self, ok: bool, label: str) -> None:
        print(f"  {'✅' if ok else '❌'} {label}")
        if not ok:
            self.failures.append(label)


def today_kst() -> date:
    return datetime.now(KST).date()


def dayuse(d: date, hour: int) -> dict:
    return {"type": "DAYUSE", "date": d.isoformat(), "start_hour": hour, "guest_name": "부하", "guest_phone": "010-0000-0000"}


def stay(d: date, nights: int) -> dict:
    return {"type": "STAY", "check_in": d.isoformat(), "nights": nights, "guest_name": "부하", "guest_phone": "010-0000-0000"}


async def together(coros) -> list:
    """Start all requests at the same instant."""
    gate = asyncio.Event()

    async def wait_then(c):
        await gate.wait()
        return await c

    tasks = [asyncio.create_task(wait_then(c)) for c in coros]
    await asyncio.sleep(0.05)
    gate.set()
    return await asyncio.gather(*tasks)


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bases", required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--users", type=int, default=40)
    ap.add_argument("--soak-seconds", type=float, default=20)
    ap.add_argument("--days-ahead", type=int, default=40)
    args = ap.parse_args()
    bases = args.bases.split(",")
    run = Run()
    limits = httpx.Limits(max_connections=1000)
    clients: list[httpx.AsyncClient] = []

    def client_for(i: int) -> httpx.AsyncClient:
        c = httpx.AsyncClient(base_url=bases[i % len(bases)], timeout=60, limits=limits)
        clients.append(c)
        return c

    stamp = int(time.time())
    print(f"servers: {bases} · users: {args.users}")
    users = [client_for(i) for i in range(args.users)]
    await asyncio.gather(*[run.call(c, "POST", "/api/auth/signup", json={
        "email": f"load-{stamp}-{i}@example.com", "password": "password123", "name": f"부하{i}", "phone": "010-1234-0000"})
        for i, c in enumerate(users)])
    admin = client_for(1)
    await run.call(admin, "POST", "/api/auth/login", json=ADMIN)
    base_day = today_kst() + timedelta(days=args.days_ahead)

    print("\n[A] same slot from every user at once")
    res = await together([run.call(c, "POST", "/api/reservations", json=dayuse(base_day, 15)) for c in users])
    codes = Counter(r.status_code for r in res)
    run.check(codes[201] == 1 and codes[409] == len(users) - 1, f"exactly one 201, rest 409 → {dict(codes)}")

    print("\n[B] overlapping day-use and stays around one day")
    d = base_day + timedelta(days=2)
    rng = random.Random(stamp)
    picks = [dayuse(d, rng.randint(10, 20)) if rng.random() < 0.6 else stay(d + timedelta(days=rng.choice([-1, 0])), rng.choice([1, 2]))
             for _ in users]
    res = await together([run.call(c, "POST", "/api/reservations", json=p) for c, p in zip(users, picks)])
    codes = Counter(r.status_code for r in res)
    run.check(codes[201] >= 1 and set(codes) <= {201, 409}, f"only 201/409, at least one winner → {dict(codes)}")

    print("\n[C] admin block vs guest bookings on the same day")
    d = base_day + timedelta(days=5)
    block = {"start_at": f"{d}T00:00:00+09:00", "end_at": f"{d + timedelta(days=1)}T00:00:00+09:00", "reason": "부하 점검"}
    res = await together([run.call(admin, "POST", "/api/admin/blocks", json=block)]
                         + [run.call(c, "POST", "/api/reservations", json=dayuse(d, 10 + i % 11)) for i, c in enumerate(users)])
    block_code, booking_codes = res[0].status_code, Counter(r.status_code for r in res[1:])
    exclusive = (block_code == 201 and booking_codes[201] == 0) or (block_code == 409 and booking_codes[201] >= 1)
    run.check(exclusive, f"block {block_code} vs bookings {dict(booking_codes)} are mutually exclusive")

    print("\n[D] the same reservation cancelled from many places at once")
    owner = users[0]
    r = await run.call(owner, "POST", "/api/reservations", json=dayuse(base_day + timedelta(days=8), 12))
    rid = r.json()["id"]
    twins = [client_for(i) for i in range(12)]  # the owner's session, opened on every server
    for t in twins:
        t.cookies.update(owner.cookies)
    res = await together([run.call(t, "POST", f"/api/reservations/{rid}/cancel") for t in twins])
    codes = Counter(r.status_code for r in res)
    run.check(codes[200] == 1 and codes[409] == len(twins) - 1, f"exactly one cancel succeeds → {dict(codes)}")

    print("\n[E] cancel and re-book the same slot at the same time")
    d = base_day + timedelta(days=10)
    r = await run.call(users[1], "POST", "/api/reservations", json=dayuse(d, 15))
    rid = r.json()["id"]
    res = await together([run.call(users[1], "POST", f"/api/reservations/{rid}/cancel")]
                         + [run.call(c, "POST", "/api/reservations", json=dayuse(d, 15)) for c in users[2:]])
    cancel_code, rebook = res[0].status_code, Counter(r.status_code for r in res[1:])
    run.check(cancel_code == 200 and rebook[201] <= 1, f"cancel {cancel_code}, re-book winners {rebook[201]} (≤ 1) → {dict(rebook)}")

    print(f"\n[F] random soak for {args.soak_seconds:.0f}s (book / quote / cancel own)")
    window = [base_day + timedelta(days=12 + i) for i in range(7)]
    deadline = time.perf_counter() + args.soak_seconds
    mine: dict[int, list[int]] = {i: [] for i in range(len(users))}

    async def worker(i: int, c: httpx.AsyncClient) -> None:
        wr = random.Random(stamp + i)
        while time.perf_counter() < deadline:
            roll = wr.random()
            day = wr.choice(window)
            if roll < 0.55:
                body = dayuse(day, wr.randint(10, 20)) if wr.random() < 0.7 else stay(day, wr.choice([1, 2]))
                res = await run.call(c, "POST", "/api/reservations", json=body)
                if res.status_code == 201:
                    mine[i].append(res.json()["id"])
            elif roll < 0.8:
                body = {k: v for k, v in dayuse(day, wr.randint(10, 20)).items() if k not in ("guest_name", "guest_phone")}
                await run.call(c, "POST", "/api/quotes", json=body)
            elif mine[i]:
                await run.call(c, "POST", f"/api/reservations/{mine[i].pop(wr.randrange(len(mine[i])))}/cancel")

    soak_start = sum(run.statuses.values())
    await asyncio.gather(*[worker(i, c) for i, c in enumerate(users)])
    print(f"  {sum(run.statuses.values()) - soak_start} requests")

    for c in clients:
        await c.aclose()

    print("\n[DB] invariants")
    with psycopg.connect(args.db) as conn:
        q = lambda sql: conn.execute(sql).fetchone()[0]
        overlaps = q("""SELECT count(*) FROM reservations a JOIN reservations b ON a.id < b.id AND a.room_id = b.room_id
                        AND a.status = 'CONFIRMED' AND b.status = 'CONFIRMED'
                        AND tstzrange(a.start_at, a.blocked_until, '[)') && tstzrange(b.start_at, b.blocked_until, '[)')""")
        run.check(overlaps == 0, f"overlapping CONFIRMED pairs: {overlaps}")
        missing = q("SELECT count(*) FROM reservations r LEFT JOIN payments p ON p.reservation_id = r.id WHERE r.type <> 'BLOCK' AND p.id IS NULL")
        run.check(missing == 0, f"bookings without a payment: {missing}")
        wrong = q("""SELECT count(*) FROM reservations r JOIN payments p ON p.reservation_id = r.id
                     WHERE (r.status = 'CONFIRMED' AND p.status <> 'PAID') OR (r.status = 'CANCELLED' AND p.status <> 'REFUNDED')""")
        run.check(wrong == 0, f"payments not matching reservation state: {wrong}")
        ids = list(run.created)
        stored = q(f"SELECT count(*) FROM reservations WHERE id = ANY(ARRAY{ids}::int[])") if ids else 0
        run.check(stored == len(ids), f"201 responses stored: {stored}/{len(ids)}")

    lat = sorted(run.latencies)
    p = lambda f: lat[min(len(lat) - 1, int(len(lat) * f))] * 1000
    print(f"\nHTTP statuses: {dict(sorted(run.statuses.items()))}")
    print(f"latency ms: p50 {statistics.median(lat) * 1000:.0f} · p95 {p(0.95):.0f} · p99 {p(0.99):.0f} · max {lat[-1] * 1000:.0f}")
    run.check(not any(s >= 500 for s in run.statuses), "no 5xx responses")
    if run.failures:
        print("\nFAILURES:\n  " + "\n  ".join(run.failures[:20]))
        return 1
    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
