import jwt
from app.models import UserAccount
from argon2 import PasswordHasher
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import get_db
from argon2.exceptions import VerifyMismatchError
from datetime import datetime, UTC, timedelta
from app.config import settings


bearer_scheme = HTTPBearer()


def register_new_user(
        email: str,
        password: str,
        db: Session = Depends(get_db),
):
    ph = PasswordHasher()
    
    # Checks if email is already in database
    existing=db.query(UserAccount).filter(UserAccount.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    new_user = UserAccount(
        email=email,
        hashed_pass=ph.hash(password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "email": new_user.email,
    }

def user_login(
        email: str,
        password: str,
        db: Session = Depends(get_db),
):
    ph = PasswordHasher()

    existing = db.query(UserAccount).filter(UserAccount.email == email).first()
    if not existing:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    try:
        ph.verify(existing.hashed_pass, password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Issue token #
    encoded_jwt = jwt.encode({
    "sub": str(existing.id),
    "exp": datetime.now(UTC) + timedelta(minutes=60)},
    settings.JWT_SECRET,
    algorithm="HS256",
    )

    return encoded_jwt

def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
        db: Session = Depends(get_db),
):

    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=["HS256"])

    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user_id = int(payload["sub"])

    existing = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if not existing:
        raise HTTPException(status_code=401, detail="No account")
    
    if not existing.is_active:
        raise HTTPException(status_code=401, detail="Account not active")
    
    return {
        "id": existing.id,
        "email": existing.email,
    }

