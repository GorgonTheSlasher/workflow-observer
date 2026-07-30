import json

from fastapi import Request
from sqlalchemy.orm import Session

from app.alerts import get_alerts_for_event, send_slack_alert
from app.event_handlers import EVENT_HANDLERS
from app.services.event_services import verify_signature, save_event
from app.services.installation_services import delete_installation
from app.broadcaster import broadcaster

# debug function for payload info
#=======================================================#

def debug_payload(payload: dict):
    import json

    print("PAYLOAD KEYS:", payload.keys())

    workflow_run = payload.get("workflow_run", {})
    print("WORKFLOW_RUN KEYS:", workflow_run.keys())

    print("=" * 80)
    print(json.dumps(payload, indent=2))
    print("=" * 80)

#========================================================#

async def dispatch_github_webhook(
    request: Request,
    x_github_event: str,
    x_hub_signature_256: str,
    db: Session,
    secret: str,
):
    body = await request.body()

    verify_signature(body, x_hub_signature_256, secret)

    payload = json.loads(body)

    # debug
    # debug_payload(payload)

    installation_id = (payload.get("installation") or {}).get("id")

    if x_github_event == "installation" and payload.get("action") == "deleted":
        delete_installation(installation_id, db)
        return {"success": True, "event": "installation", "action": "deleted"}

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
        installation_id=installation_id,
    )

    await broadcaster.publish({"event_type": x_github_event})

    for alert_payload, webhook_url in get_alerts_for_event(x_github_event, event_data, saved_event, db):
        send_slack_alert(alert_payload, webhook_url)

    return {
        "success": True,
        "event": x_github_event,
        "saved_event_id": saved_event.id,
        "result": event_data,
    }