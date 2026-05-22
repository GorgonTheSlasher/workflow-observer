import json
from fastapi import FastAPI, Request, Header, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.event_handlers import EVENT_HANDLERS
from app.services import verify_signature, save_event
from app.models import GitHubEvent

app = FastAPI(title="GitHub Workflow Observer")

# Check that FastAPI server is initialize
@app.get("/")
def root():
    return {"status": "ok"}

# Main director for webhook handling. Verifies incoming signature. Confirms event is handleable. Saves event to database.
@app.post("/webhook")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(None),
    x_hub_signature_256: str = Header(None),
    db: Session = Depends(get_db)
):
    body = await request.body()

    verify_signature(body, x_hub_signature_256)

    payload = json.loads(body)

    # Debug- console event dump
    print(f"\nEVENT Type: {x_github_event}")
    print(json.dumps(payload, indent=2))
    print(payload.keys())
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

# Shows log of events
@app.get("/events")
def get_events(db: Session = Depends(get_db)):

    return db.query(GitHubEvent).order_by(GitHubEvent.created_at.desc()).all()

# Shows failed workflows
@app.get("/workflow-runs/failures")
def get_failed_workflow_runs(db: Session = Depends(get_db)):

    return (
        db.query(GitHubEvent)
        .filter(GitHubEvent.event_type == "workflow_run")
        .filter(GitHubEvent.conclusion == "failure")
        .order_by(GitHubEvent.created_at.desc())
        .all()
    )