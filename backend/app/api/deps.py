from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Path, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import decode_access_token
from app.models import User

DB = Annotated[Session, Depends(get_db)]
# Path ids are PostgreSQL int4; anything larger is a 422 instead of a DataError 500.
DbId = Annotated[int, Path(ge=1, le=2_147_483_647)]


def get_current_user(request: Request, db: DB) -> User:
    token = request.cookies.get(get_settings().cookie_name)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "NOT_AUTHENTICATED")
    try:
        payload = decode_access_token(token)
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "NOT_AUTHENTICATED")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "FORBIDDEN")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
