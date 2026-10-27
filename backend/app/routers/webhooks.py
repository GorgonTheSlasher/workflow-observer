from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.event_dispatcher import dispatch_github_webhook

router = APIRouter(tags=["webhooks"])


@router.post("/webhook")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(None),
    x_hub_signature_256: str = Header(None),
    x_github_delivery: str = Header(None),
    db: Session = Depends(get_db),
):
    return await dispatch_github_webhook(
        request=request,
        x_github_event=x_github_event,
        x_hub_signature_256=x_hub_signature_256,
        db=db,
        background_tasks=background_tasks,
        x_github_delivery=x_github_delivery,
        secret=settings.GITHUB_WEBHOOK_SECRET,
    )


@router.post("/webhook/github-app")
async def github_app_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(None),
    x_hub_signature_256: str = Header(None),
    x_github_delivery: str = Header(None),
    db: Session = Depends(get_db),
):
    return await dispatch_github_webhook(
        request=request,
        x_github_event=x_github_event,
        x_hub_signature_256=x_hub_signature_256,
        db=db,
        background_tasks=background_tasks,
        x_github_delivery=x_github_delivery,
        secret=settings.GITHUB_APP_WEBHOOK_SECRET,
    )
