import json
from app.event_handlers import EVENT_HANDLERS
from fastapi import Request
from sqlalchemy.orm import Session
from app.services import verify_signature, save_event


async def dispatch_github_webhook(
    request: Request,
    x_github_event: str,
    x_hub_signature_256: str,
    db: Session
):
    body = await request.body()

    verify_signature(body, x_hub_signature_256)

    payload = json.loads(body)

    # Debug- console event dump
    # print(f"\nEVENT Type: {x_github_event}")
    # print(json.dumps(payload, indent=2))
    # print(payload.keys())
    ###---###

    handler = EVENT_HANDLERS.get(x_github_event)

    if not handler:
        return {
            "success": False,
            "message": f"No handler for event: {x_github_event}"
        }
    
    event_data = handler(payload)

    saved_event = save_event(
        db=db,
        event_type=x_github_event,
        data=event_data,
    )

    return {
        "success": True,
        "event": x_github_event,
        "saved_event_id": saved_event.id,
        "result": event_data,
    }