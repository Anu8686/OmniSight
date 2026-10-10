from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import COOKIE_NAME, current_user
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.api import LoginIn, ProfileUpdate, RegisterIn, UserOut
from app.security.rate_limit import auth_limiter
from app.services.audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Constant-time-ish dummy hash so unknown emails cost the same as wrong passwords.
_DUMMY = hash_password("not-a-real-password-1")


def _set_cookie(resp: Response, user_id: int) -> None:
    s = get_settings()
    resp.set_cookie(
        COOKIE_NAME, create_access_token(user_id), httponly=True, samesite="lax", secure=s.is_production,
        max_age=s.access_token_minutes * 60, path="/",
    )


@router.post("/register", response_model=UserOut, status_code=201, dependencies=[Depends(auth_limiter)])
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    user = User(email=email, name=body.name, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    audit(db, user.id, "auth.register", "user", user.id)
    _set_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(auth_limiter)])
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY)
    if not user or not ok or not user.is_active:
        raise HTTPException(401, "Incorrect email or password.")
    audit(db, user.id, "auth.login", "user", user.id)
    _set_cookie(response, user.id)
    return user


@router.post("/logout", status_code=204)
def logout(response: Response, request: Request):
    response.delete_cookie(COOKIE_NAME, path="/")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.name = body.name.strip()
    db.commit()
    return user
