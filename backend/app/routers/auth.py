from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import AuthCredentials
from app.services.installation_services import is_viewing_demo_data
from app.services.auth_services import (
    get_current_user,
    get_github_authorize_url,
    login_demo,
    login_with_github,
    register_new_user,
    user_login,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/register")
def register_user(credentials: AuthCredentials, db: Session = Depends(get_db)):
    return register_new_user(email=credentials.email, password=credentials.password, db=db)


@router.post("/auth/login")
def login_user(credentials: AuthCredentials, db: Session = Depends(get_db)):
    token = user_login(email=credentials.email, password=credentials.password, db=db)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/auth/demo")
def demo_login(db: Session = Depends(get_db)):
    token = login_demo(db=db)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/auth/github/login")
def github_login():
    return RedirectResponse(get_github_authorize_url())


@router.get("/github-app/auth")
def github_app_auth(
    code: str,
    installation_id: int | None = None,
    db: Session = Depends(get_db),
):
    token = login_with_github(code=code, db=db, installation_id=installation_id)
    return RedirectResponse(f"{settings.FRONTEND_BASE_URL}/?token={token}")


@router.get("/auth/me")
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        **current_user,
        "viewing_demo_data": is_viewing_demo_data(current_user["id"], db),
    }
