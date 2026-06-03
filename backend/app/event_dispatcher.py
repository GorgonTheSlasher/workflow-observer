import json

from fastapi import Request
from sqlalchemy.orm import Session

from app.alerts import should_alert_on_event, format_workflow_failure_alert, send_slack_alert
from app.event_handlers import EVENT_HANDLERS
from app.services import verify_signature, save_event

# debug function for payload info

def debug_payload(payload: dict):
    import json

    print("=" * 80)
    print(json.dumps(payload, indent=2))
    print("=" * 80)


async def dispatch_github_webhook(
    request: Request,
    x_github_event: str,
    x_hub_signature_256: str,
    db: Session
):
    body = await request.body()

    verify_signature(body, x_hub_signature_256)

    payload = json.loads(body)

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

    debug_payload(payload)

    should_alert = should_alert_on_event(
        x_github_event,
        event_data,
    )

    if should_alert:
        message = format_workflow_failure_alert(event_data)
        send_slack_alert(message)

    return {
        "success": True,
        "event": x_github_event,
        "saved_event_id": saved_event.id,
        "result": event_data,
    }