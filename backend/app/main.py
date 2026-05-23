from fastapi import FastAPI, Request, Header, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.event_dispatcher import dispatch_github_webhook
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

    return await dispatch_github_webhook(
        request=request,
        x_github_event=x_github_event,
        x_hub_signature_256=x_hub_signature_256,
        db=db
    )

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