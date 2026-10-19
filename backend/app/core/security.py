import threading
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

_hasher = PasswordHash.recommended()
ALGORITHM = "HS256"


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
    """Raises jwt.PyJWTError on a bad or expired token."""
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
