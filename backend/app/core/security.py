import hashlib
import threading
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

_hasher = PasswordHash.recommended()
ALGORITHM = "HS256"
DEVICE_TYP = "device"


_limiter: threading.BoundedSemaphore | None = None
_limiter_guard = threading.Lock()


def _hash_slot() -> threading.BoundedSemaphore:
    """Per-process cap on concurrent argon2 work (each call allocates ~64 MB); extra callers queue."""
    global _limiter
    with _limiter_guard:
        if _limiter is None:
            _limiter = threading.BoundedSemaphore(get_settings().password_hash_concurrency)
        return _limiter


def reset_hash_limiter() -> None:
    global _limiter
    with _limiter_guard:
        _limiter = None


def hash_password(pw: str) -> str:
    with _hash_slot():
        return _hasher.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    with _hash_slot():
        return _hasher.verify(pw, hashed)


def create_access_token(user_id: int, role: str) -> str:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(minutes=s.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, s.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError on a bad or expired token, or on a device token presented as a session."""
    payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    if payload.get("typ") == DEVICE_TYP:
        raise jwt.InvalidTokenError("device token is not a session")
    return payload


def _email_digest(email: str) -> str:
    return hashlib.sha256(email.lower().encode()).hexdigest()


def create_device_token(email: str, device_id: str | None = None) -> str:
    """Marks this browser as one that has signed in to `email`; carries no access rights by itself.
    Pass the existing `device_id` to extend a known device instead of minting a new one (a new ID = a new bucket)."""
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(days=s.device_cookie_days)
    return jwt.encode({"typ": DEVICE_TYP, "sub": _email_digest(email), "jti": device_id or uuid.uuid4().hex, "exp": exp},
                      s.jwt_secret, algorithm=ALGORITHM)


def device_id_for(token: str | None, email: str) -> str | None:
    """The device ID if `token` is a valid device token for this account, else None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != DEVICE_TYP or payload.get("sub") != _email_digest(email):
        return None
    jti = payload.get("jti")
    return jti if isinstance(jti, str) and len(jti) == 32 else None
