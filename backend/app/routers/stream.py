import asyncio
import json

import jwt as pyjwt
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.broadcaster import broadcaster
from app.config import settings
from app.database import SessionLocal
from app.models import UserAccount

router = APIRouter(tags=["stream"])


@router.get("/events/stream")
async def event_stream(token: str):
    db = SessionLocal()
    try:
        try:
            payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        except pyjwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = int(payload["sub"])
        user = db.query(UserAccount).filter(
            UserAccount.id == user_id,
            UserAccount.is_active.is_(True),
        ).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
    finally:
        db.close()

    async def generate():
        q = broadcaster.subscribe()
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
