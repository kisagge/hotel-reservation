from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas import LoginIn, SignupIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session(response: Response, user: User) -> None:
    s = get_settings()
    response.set_cookie(s.cookie_name, create_access_token(user.id, user.role), max_age=s.jwt_expire_minutes * 60,
                        httponly=True, samesite="lax", path="/")


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: DB, response: Response) -> User:
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "EMAIL_TAKEN")
    user = User(email=email, password_hash=hash_password(body.password), name=body.name, phone=body.phone)
    db.add(user)
    db.commit()
    _set_session(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, db: DB, response: Response) -> User:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS")
    _set_session(response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(get_settings().cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
