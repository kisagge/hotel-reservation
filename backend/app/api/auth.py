from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, CurrentUser
from app.core.clock import get_now
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_device_token,
    device_id_for,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas import LoginIn, SignupIn, UserOut
from app.services.rate_limit import client_ip, enforce, subject_key

router = APIRouter(prefix="/api/auth", tags=["auth"])
Now = Annotated[datetime, Depends(get_now)]


def _set_session(response: Response, user: User, device_id: str | None = None) -> None:
    s = get_settings()
    response.set_cookie(s.cookie_name, create_access_token(user.id, user.role), max_age=s.jwt_expire_minutes * 60,
                        httponly=True, samesite="lax", path="/", secure=s.session_cookie_secure)
    # Survives logout on purpose; only sent to the auth endpoints.
    response.set_cookie(s.device_cookie_name, create_device_token(user.email, device_id), max_age=s.device_cookie_days * 86400,
                        httponly=True, samesite="strict", path="/api/auth", secure=s.session_cookie_secure)


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: DB, response: Response, request: Request, now: Now) -> User:
    s = get_settings()
    enforce(db, [(f"signup:ip:{client_ip(request)}", s.signup_per_ip_limit, s.signup_per_ip_window_s)], now)
    email = body.email.lower()
    # Hash before touching the DB: argon2 is slow on purpose and must not pin a pooled connection.
    password_hash = hash_password(body.password)
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "EMAIL_TAKEN")
    user = User(email=email, password_hash=password_hash, name=body.name, phone=body.phone)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # lost a race with a concurrent signup for the same email
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "EMAIL_TAKEN")
    _set_session(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, db: DB, response: Response, request: Request, now: Now) -> User:
    s = get_settings()
    device = device_id_for(request.cookies.get(s.device_cookie_name), body.email)
    ip = client_ip(request)
    if device:  # this browser signed in to this account before: budgets untouched by lockouts aimed at strangers
        checks = [(f"login:device:{device}", s.login_per_device_limit, s.login_per_device_window_s),
                  (subject_key("login:device-account", body.email.lower()), s.login_per_device_account_limit,
                   s.login_per_device_account_window_s),
                  (f"login:device-ip:{ip}", s.login_per_device_ip_limit, s.login_per_device_ip_window_s)]
    else:
        checks = [(subject_key("login:email", body.email.lower()), s.login_per_email_limit, s.login_per_email_window_s),
                  (f"login:ip:{ip}", s.login_per_ip_limit, s.login_per_ip_window_s)]
    enforce(db, checks, now)
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    stored_hash = user.password_hash if user else None
    db.rollback()  # return the connection to the pool before the slow argon2 verify
    if user is None or not verify_password(body.password, stored_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS")
    _set_session(response, user, device)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(get_settings().cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
