from fastapi import FastAPI, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import get_db, Base, engine
from app.event_dispatcher import dispatch_github_webhook
from app.models import GitHubEvent
from app.services import get_filtered_events

from app.alerts import send_slack_alert

Base.metadata.create_all(bind=engine)

app = FastAPI(title="GitHub Workflow Observer")

# Makes it so browser wont block frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Shows queriable log of events 
@app.get("/events")
def get_events(
    event_type: str | None = None,
    repo_name: str | None = None,
    actor: str | None = None,
    conclusion: str | None = None,
    db: Session = Depends(get_db),
):
    return get_filtered_events(
        db=db,
        event_type=event_type,
        repo_name=repo_name,
        actor=actor,
        conclusion=conclusion,
    )

# Shows failed workflows
@app.get("/events/workflow-runs/failures")
def get_failed_workflow_runs(db: Session = Depends(get_db)):

    return (
        db.query(GitHubEvent)
        .filter(GitHubEvent.event_type == "workflow_run")
        .filter(GitHubEvent.conclusion == "failure")
        .order_by(GitHubEvent.created_at.desc())
        .all()
    )

# Shows a limited amout of recent events
@app.get("/events/recent")
def get_recent_events(
    limit: int = 10,
    db: Session = Depends(get_db),
):
    return (
        db.query(GitHubEvent)
        .order_by(GitHubEvent.created_at.desc())
        .limit(limit)
        .all()
    )

# Summarizes all events show success/failures
@app.get("/repository-summary")
def get_repository_summary(
    repo_name: str,
    db: Session = Depends(get_db),
):
    total_events = db.query(GitHubEvent).filter(
        GitHubEvent.repo_name == repo_name
    ).count()

    failed_workflows = db.query(GitHubEvent).filter(
        GitHubEvent.repo_name == repo_name,
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion == "failure",
    ).count()

    successful_workflows = db.query(GitHubEvent).filter(
        GitHubEvent.repo_name == repo_name,
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion == "success",
    ).count()

    return {
        "repo_name": repo_name,
        "total_events": total_events,
        "failed_workflows": failed_workflows,
        "successful_workflows": successful_workflows,
    }

# Look up actor activity
@app.get("/actors/{actor}/activity")
def get_actor_activity(
    actor: str,
    db: Session = Depends(get_db),
):
    events = (
        db.query(GitHubEvent)
        .filter(GitHubEvent.actor == actor)
        .order_by(GitHubEvent.created_at.desc())
        .all()
    )

    return events

# Route for debugging without having to push to test repo
@app.post("/test-alert")
def test_alert():
    send_slack_alert("Test alert from Workflow Observer")
    return {"success": True}