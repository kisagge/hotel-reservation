from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

_hasher = PasswordHash.recommended()
ALGORITHM = "HS256"


def hash_password(pw: str) -> str:
    return _hasher.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return _hasher.verify(pw, hashed)


def create_access_token(user_id: int, role: str) -> str:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(minutes=s.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, s.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError on a bad or expired token."""
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
