import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.broadcaster import broadcaster
from app.database import SessionLocal
from app.models import UserAccount
from app.services.installation_services import get_user_installation_ids
from app.services.auth_services import get_current_user, get_stream_ticket_user_id, issue_stream_ticket

router = APIRouter(tags=["stream"])


@router.post("/events/stream-ticket")
def stream_ticket(current_user: dict = Depends(get_current_user)):
    return {"ticket": issue_stream_ticket(current_user["id"])}


@router.get("/events/stream")
async def event_stream(ticket: str):
    user_id = get_stream_ticket_user_id(ticket)

    db = SessionLocal()
    try:
        user = db.query(UserAccount).filter(
            UserAccount.id == user_id,
            UserAccount.is_active.is_(True),
        ).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid stream ticket")

        # Fixed for the life of the connection; the frontend reconnects with a fresh ticket
        # after any drop, which picks up newly linked installations
        installation_ids = get_user_installation_ids(user_id, db)
    finally:
        db.close()

    async def generate():
        q = broadcaster.subscribe(installation_ids)
        try:
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"event": "new_event", "data": json.dumps(data)}
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            broadcaster.unsubscribe(q)

    return EventSourceResponse(generate())
