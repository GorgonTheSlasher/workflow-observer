import jwt
import requests
from urllib.parse import urlencode
from app.models import UserAccount
from argon2 import PasswordHasher
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import get_db
from argon2.exceptions import VerifyMismatchError
from datetime import datetime, UTC, timedelta
from app.config import settings
from app.services.installation_services import link_installation


bearer_scheme = HTTPBearer()

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_API_URL = "https://api.github.com/user"
GITHUB_USER_INSTALLATIONS_URL = "https://api.github.com/user/installations"


def _issue_jwt(user_id: int) -> str:
    return jwt.encode(
        {
            "sub": str(user_id),
            "exp": datetime.now(UTC) + timedelta(minutes=60),
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )


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
    if not existing or not existing.hashed_pass:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    try:
        ph.verify(existing.hashed_pass, password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    return _issue_jwt(existing.id)

def get_github_authorize_url() -> str:
    params = {
        "client_id": settings.GITHUB_APP_CLIENT_ID,
        "redirect_uri": settings.GITHUB_APP_REDIRECT_URI,
    }
    return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"

def find_user_installation(github_access_token: str, installation_id: int) -> dict | None:

    '''The installation_id in the setup callback is a plain query param and can be forged.
    Confirm it against the installations GitHub says this user can access before linking it.
    Returns GitHub's installation object, or None if the user can't access it.'''

    url = f"{GITHUB_USER_INSTALLATIONS_URL}?per_page=100"

    while url:
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {github_access_token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )

        if not response.ok:
            return None

        for inst in response.json().get("installations", []):
            if inst.get("id") == installation_id:
                return inst

        url = response.links.get("next", {}).get("url")

    return None

def login_with_github(
        code: str,
        db: Session = Depends(get_db),
        installation_id: int | None = None,
):
    token_response = requests.post(
        GITHUB_TOKEN_URL,
        headers={"Accept": "application/json"},
        data={
            "client_id": settings.GITHUB_APP_CLIENT_ID,
            "client_secret": settings.GITHUB_APP_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GITHUB_APP_REDIRECT_URI,
        },
        timeout=10,
    )

    if not token_response.ok:
        raise HTTPException(status_code=401, detail="GitHub authorization failed")

    github_access_token = token_response.json().get("access_token")
    if not github_access_token:
        raise HTTPException(status_code=401, detail="GitHub authorization failed")

    user_response = requests.get(
        GITHUB_USER_API_URL,
        headers={"Authorization": f"Bearer {github_access_token}"},
        timeout=10,
    )

    if not user_response.ok:
        raise HTTPException(status_code=401, detail="Could not fetch GitHub profile")

    github_user = user_response.json()
    github_id = github_user.get("id")
    github_username = github_user.get("login")

    existing = db.query(UserAccount).filter(UserAccount.github_id == github_id).first()

    if not existing:
        github_email = github_user.get("email")

        # Don't claim an email that's already tied to a different account
        if github_email and db.query(UserAccount).filter(UserAccount.email == github_email).first():
            github_email = None

        existing = UserAccount(
            github_id=github_id,
            github_username=github_username,
            email=github_email,
        )
        db.add(existing)
        db.commit()
        db.refresh(existing)

    if not existing.is_active:
        raise HTTPException(status_code=401, detail="Account not active")

    if installation_id:
        installation = find_user_installation(github_access_token, installation_id)
        if installation is None:
            raise HTTPException(status_code=403, detail="Installation does not belong to this user")

        link_installation(
            installation_id=installation_id,
            user_id=existing.id,
            db=db,
            account_login=(installation.get("account") or {}).get("login"),
        )

    return _issue_jwt(existing.id)

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
        "github_username": existing.github_username,
        "is_demo": existing.is_demo,
        "created_at": existing.created_at.isoformat() if existing.created_at else None,
    }

def get_current_non_demo_user(current_user: dict = Depends(get_current_user)):

    '''The demo account is shared by every visitor, so it can't change settings or send Slack messages'''

    if current_user["is_demo"]:
        raise HTTPException(status_code=403, detail="Not available in the demo account")

    return current_user

def login_demo(db: Session) -> str:

    '''Issues a token for the shared demo account, creating it on first use'''

    if not settings.DEMO_INSTALLATION_IDS:
        raise HTTPException(status_code=404, detail="Demo is not configured")

    demo_user = db.query(UserAccount).filter(UserAccount.is_demo.is_(True)).first()

    if not demo_user:
        demo_user = UserAccount(github_username="demo", is_demo=True)
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)

    return _issue_jwt(demo_user.id)
