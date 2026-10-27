import json

from fastapi import BackgroundTasks, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.alerts import get_alerts_for_event, send_slack_alert
from app.event_handlers import EVENT_HANDLERS
from app.services.event_services import get_event_by_delivery_id, verify_signature, save_event
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

def _duplicate_response(x_github_event: str, delivery_id: str) -> dict:
    # 2xx so GitHub treats the delivery as handled and stops retrying it
    return {
        "success": True,
        "event": x_github_event,
        "duplicate": True,
        "delivery_id": delivery_id,
    }


async def dispatch_github_webhook(
    request: Request,
    x_github_event: str,
    x_hub_signature_256: str,
    db: Session,
    secret: str,
    background_tasks: BackgroundTasks,
    x_github_delivery: str | None = None,
):
    body = await request.body()

    verify_signature(body, x_hub_signature_256, secret)

    payload = json.loads(body)

    # debug
    # debug_payload(payload)

    installation_id = (payload.get("installation") or {}).get("id")

    # DB calls are synchronous, so run them in the threadpool instead of blocking the event loop
    if x_github_event == "installation" and payload.get("action") == "deleted":
        await run_in_threadpool(delete_installation, installation_id, db)
        return {"success": True, "event": "installation", "action": "deleted"}

    handler = EVENT_HANDLERS.get(x_github_event)

    if not handler:
        return {
            "success": False,
            "message": f"No handler for event: {x_github_event}"
        }

    # GitHub retries failed/timed-out deliveries and allows manual redelivery,
    # both reusing the same X-GitHub-Delivery GUID. Skip ones already processed.
    if x_github_delivery and await run_in_threadpool(get_event_by_delivery_id, db, x_github_delivery):
        return _duplicate_response(x_github_event, x_github_delivery)

    event_data = handler(payload)

    try:
        saved_event = await run_in_threadpool(
            save_event,
            db=db,
            event_type=x_github_event,
            data=event_data,
            installation_id=installation_id,
            delivery_id=x_github_delivery,
        )
    except IntegrityError:
        # Lost a race with a concurrent copy of the same delivery; the unique index caught it
        db.rollback()
        return _duplicate_response(x_github_event, x_github_delivery)

    alerts = await run_in_threadpool(get_alerts_for_event, x_github_event, event_data, saved_event, db)

    await broadcaster.publish({"event_type": x_github_event})

    # Slack calls run after the response is sent, so a slow Slack can't push
    # us past GitHub's 10 second delivery timeout
    for alert_payload, webhook_url in alerts:
        background_tasks.add_task(send_slack_alert, alert_payload, webhook_url)

    return {
        "success": True,
        "event": x_github_event,
        "saved_event_id": saved_event.id,
        "result": event_data,
    }
