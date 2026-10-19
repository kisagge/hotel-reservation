"""argon2id uses 64 MB per hash (pwdlib recommended). Unbounded parallel hashing can exhaust RAM in a signup burst."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from app.core import security
from app.core.config import get_settings


def test_password_hashing_concurrency_is_capped(monkeypatch):
    monkeypatch.setattr(get_settings(), "password_hash_concurrency", 2)
    security.reset_hash_limiter()
    active, peak, lock = 0, 0, threading.Lock()
    real = security._hasher.hash

    def slow_hash(pw):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.05)
        with lock:
            active -= 1
        return real(pw)

    monkeypatch.setattr(security._hasher, "hash", slow_hash)
    with ThreadPoolExecutor(8) as pool:
        hashes = list(pool.map(security.hash_password, ["password123"] * 8))
    assert peak == 2
    assert all(security.verify_password("password123", h) for h in hashes)
