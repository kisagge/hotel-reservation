"""Security hardening: production config guard, cookie flags, headers, auth rate limits, upload sniffing."""

import pytest

from app.core.config import Settings, get_settings
from app.main import assert_safe_settings
from tests.conftest import ADMIN, GUEST


# ---- production configuration guard ---------------------------------------------------------------------------
def test_prod_refuses_default_or_short_jwt_secret():
    with pytest.raises(RuntimeError, match="HARU_JWT_SECRET"):
        assert_safe_settings(Settings(environment="prod"))
    with pytest.raises(RuntimeError, match="HARU_JWT_SECRET"):
        assert_safe_settings(Settings(environment="prod", jwt_secret="short"))
    assert_safe_settings(Settings(environment="prod", jwt_secret="x" * 48))
    assert_safe_settings(Settings())  # dev keeps working out of the box


def test_prod_refuses_placeholder_jwt_secret():
    """The docker-compose fallback is long and public; it must not pass for a real secret."""
    with pytest.raises(RuntimeError, match="HARU_JWT_SECRET"):
        assert_safe_settings(Settings(environment="prod", jwt_secret="docker-demo-secret-change-me-0123456789abcdef"))


def test_seed_refuses_prod(monkeypatch):
    from app import seed
    monkeypatch.setattr(get_settings(), "environment", "prod")
    monkeypatch.setattr(seed, "SessionLocal", lambda: pytest.fail("seed touched the database in prod"))
    with pytest.raises(SystemExit, match="prod"):
        seed.main()


def test_prod_cookies_are_secure_by_default():
    assert Settings(environment="prod", jwt_secret="x" * 48).session_cookie_secure is True
    assert Settings().session_cookie_secure is False
    assert Settings(cookie_secure=True).session_cookie_secure is True


def test_session_cookie_flags(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "cookie_secure", True)
    cookie = client.post("/api/auth/signup", json=GUEST).headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "secure" in cookie


# ---- response headers -----------------------------------------------------------------------------------------
def test_security_headers_on_api(client):
    h = client.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "strict-origin-when-cross-origin"


# ---- rate limits (checked before the slow argon2 work) --------------------------------------------------------
@pytest.fixture
def limits(monkeypatch):
    s = get_settings()
    for k, v in dict(rate_limit_enabled=True, login_per_email_limit=3, login_per_ip_limit=100, signup_per_ip_limit=2).items():
        monkeypatch.setattr(s, k, v)
    return s


def test_login_attempts_are_limited_per_email(client, make_client, limits, monkeypatch):
    from app.api import auth as auth_api
    make_client().post("/api/auth/signup", json=GUEST)  # signed up elsewhere: `client` is a stranger's browser
    calls = []
    real = auth_api.verify_password
    monkeypatch.setattr(auth_api, "verify_password", lambda pw, h: (calls.append(1), real(pw, h))[1])
    for _ in range(3):
        assert client.post("/api/auth/login", json={"email": GUEST["email"], "password": "wrong-pass"}).status_code == 401
    res = client.post("/api/auth/login", json={"email": GUEST["email"], "password": GUEST["password"]})
    assert res.status_code == 429
    assert res.json()["detail"] == "TOO_MANY_ATTEMPTS"
    assert int(res.headers["retry-after"]) > 0
    assert len(calls) == 3  # the blocked attempt never reached argon2
    other = client.post("/api/auth/login", json={"email": "someone@example.com", "password": "whatever1"})
    assert other.status_code == 401  # other accounts are unaffected


def test_signups_are_limited_per_client(client, limits):
    for i in range(2):
        assert client.post("/api/auth/signup", json={**GUEST, "email": f"g{i}@example.com"}).status_code == 201
    assert client.post("/api/auth/signup", json={**GUEST, "email": "g9@example.com"}).status_code == 429


def test_forwarded_for_is_ignored_unless_trusted(client, limits, monkeypatch):
    for i in range(2):
        client.post("/api/auth/signup", json={**GUEST, "email": f"h{i}@example.com"}, headers={"X-Forwarded-For": f"10.0.0.{i}"})
    spoofed = client.post("/api/auth/signup", json={**GUEST, "email": "h9@example.com"}, headers={"X-Forwarded-For": "10.0.0.99"})
    assert spoofed.status_code == 429  # a client-chosen header cannot reset its own limit
    monkeypatch.setattr(get_settings(), "trust_forwarded_for", True)
    ok = client.post("/api/auth/signup", json={**GUEST, "email": "h8@example.com"}, headers={"X-Forwarded-For": "10.0.0.50"})
    assert ok.status_code == 201  # behind a trusted edge, the edge's entry identifies the client


def test_trusted_forwarded_for_uses_the_edge_entry_not_a_client_prefix(client, limits, monkeypatch):
    """nginx's $proxy_add_x_forwarded_for appends: "<client-supplied>, <real ip>". Only the last entry is the edge's."""
    monkeypatch.setattr(get_settings(), "trust_forwarded_for", True)
    codes = [client.post("/api/auth/signup", json={**GUEST, "email": f"e{i}@example.com"},
                         headers={"X-Forwarded-For": f"6.6.6.{i}, 10.0.0.7"}).status_code for i in range(3)]
    assert codes == [201, 201, 429]


def test_very_long_email_login_is_a_normal_401(client, limits):
    email = "a" * 64 + "@" + ".".join(["b" * 63] * 2) + ".com"  # valid, 197 chars
    res = client.post("/api/auth/login", json={"email": email, "password": "whatever1"})
    assert res.status_code == 401


def test_rate_limit_window_resets(client, limits, clock):
    from datetime import timedelta
    for i in range(2):
        client.post("/api/auth/signup", json={**GUEST, "email": f"w{i}@example.com"})
    assert client.post("/api/auth/signup", json={**GUEST, "email": "w8@example.com"}).status_code == 429
    clock.set(clock.now + timedelta(minutes=11))
    assert client.post("/api/auth/signup", json={**GUEST, "email": "w9@example.com"}).status_code == 201


# ---- uploads ---------------------------------------------------------------------------------------------------
def test_upload_rejects_non_image_bytes_with_image_type(admin_client, tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    res = admin_client.post("/api/admin/room/photos", files={"file": ("x.png", b"<script>alert(1)</script>", "image/png")})
    assert res.status_code == 422
    assert res.json()["detail"] == "UNSUPPORTED_IMAGE_TYPE"
    assert list(tmp_path.iterdir()) == []


def test_upload_trusts_bytes_not_declared_type(admin_client, tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 32
    res = admin_client.post("/api/admin/room/photos", files={"file": ("x.png", jpeg, "image/png")})
    assert res.status_code == 201
    assert res.json()["url"].endswith(".jpg")


def test_failed_photo_insert_leaves_no_file(admin_client, tmp_path, monkeypatch):
    from app.api import admin as admin_api
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))

    def boom(*a, **kw):
        raise RuntimeError("db down")

    monkeypatch.setattr(admin_api, "_commit_photo", boom)
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    res = admin_client.post("/api/admin/room/photos", files={"file": ("x.png", png, "image/png")})
    assert res.status_code == 500
    assert list(tmp_path.iterdir()) == []


# ---- device cookies: a lockout aimed at an account must not lock out its owner's own browser -------------------
def _lock_out(make_client, email, n=4):
    attacker = make_client()
    codes = [attacker.post("/api/auth/login", json={"email": email, "password": "wrong-pass"}).status_code for _ in range(n)]
    assert codes[-1] == 429
    return attacker


def test_known_browser_still_logs_in_while_the_account_is_locked_for_strangers(make_client, limits):
    owner = make_client()
    assert owner.post("/api/auth/signup", json=GUEST).status_code == 201
    device = owner.cookies.get("haru_device")
    assert device
    owner.post("/api/auth/logout")
    attacker = _lock_out(make_client, GUEST["email"])
    assert owner.post("/api/auth/login", json={"email": GUEST["email"], "password": GUEST["password"]}).status_code == 200
    assert attacker.post("/api/auth/login", json={"email": GUEST["email"], "password": GUEST["password"]}).status_code == 429


def test_known_browser_survives_a_site_wide_ip_lockout(make_client, limits, monkeypatch):
    monkeypatch.setattr(limits, "login_per_ip_limit", 3)
    owner = make_client()
    owner.post("/api/auth/signup", json=GUEST)
    attacker = make_client()
    for i in range(4):  # behind Next every guest shares one IP, so this would lock everybody out
        last = attacker.post("/api/auth/login", json={"email": f"x{i}@example.com", "password": "wrong-pass"})
    assert last.status_code == 429
    assert owner.post("/api/auth/login", json={"email": GUEST["email"], "password": GUEST["password"]}).status_code == 200


def test_device_cookie_is_bound_to_its_account(make_client, limits):
    owner = make_client()
    owner.post("/api/auth/signup", json=GUEST)
    other = {**GUEST, "email": "other@example.com"}
    make_client().post("/api/auth/signup", json=other)
    _lock_out(make_client, other["email"])
    res = owner.post("/api/auth/login", json={"email": other["email"], "password": other["password"]})
    assert res.status_code == 429  # my browser is not a trusted device for someone else's account


def test_known_browser_has_its_own_attempt_limit(make_client, limits, monkeypatch):
    monkeypatch.setattr(limits, "login_per_device_limit", 2)
    owner = make_client()
    owner.post("/api/auth/signup", json=GUEST)
    codes = [owner.post("/api/auth/login", json={"email": GUEST["email"], "password": "wrong-pass"}).status_code for _ in range(3)]
    assert codes == [401, 401, 429]


def test_device_cookie_flags_and_it_is_not_a_session(client):
    res = client.post("/api/auth/signup", json=GUEST)
    cookie = [c for c in res.headers.get_list("set-cookie") if c.startswith("haru_device=")][0].lower()
    assert "httponly" in cookie and "path=/api/auth" in cookie and "max-age=" in cookie
    token = client.cookies.get("haru_device")
    client.cookies.clear()
    client.cookies.set("haru_session", token)
    assert client.get("/api/auth/me").status_code == 401


def _jti(client):
    import jwt
    return jwt.decode(client.cookies.get("haru_device"), options={"verify_signature": False})["jti"]


def test_device_id_is_kept_across_logins(make_client, limits):
    owner = make_client()
    owner.post("/api/auth/signup", json=GUEST)
    first = _jti(owner)
    owner.post("/api/auth/login", json={"email": GUEST["email"], "password": GUEST["password"]})
    assert _jti(owner) == first  # re-minting would hand out a fresh, empty bucket on every login


def test_an_accounts_devices_share_a_ceiling(make_client, limits, monkeypatch):
    """Logging in to your own account in a loop (each login a full argon2 verify) must hit a limit
    below the per-device one."""
    monkeypatch.setattr(limits, "login_per_device_account_limit", 3)
    owner = make_client()
    owner.post("/api/auth/signup", json=GUEST)
    body = {"email": GUEST["email"], "password": GUEST["password"]}
    assert [owner.post("/api/auth/login", json=body).status_code for _ in range(4)] == [200, 200, 200, 429]


def test_known_browsers_have_a_per_ip_ceiling_too(make_client, limits, monkeypatch):
    monkeypatch.setattr(limits, "login_per_device_ip_limit", 3)
    codes = []
    for i in range(2):
        c = make_client()
        acct = {**GUEST, "email": f"d{i}@example.com"}
        c.post("/api/auth/signup", json=acct)
        codes += [c.post("/api/auth/login", json={"email": acct["email"], "password": acct["password"]}).status_code
                  for _ in range(2)]
    assert codes == [200, 200, 200, 429]
