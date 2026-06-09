from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import get_db
from app.event_dispatcher import dispatch_github_webhook
from app.init_db import init_db
from app.models import GitHubEvent
from app.services import get_filtered_events

from app.alerts import send_slack_alert

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="GitHub Workflow Observer",
    lifespan=lifespan
)

# Makes it so browser wont block frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://workflow-observer.vercel.app"
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

# Summarize all of the database
@app.get("/summary")
def summarize_db(db: Session = Depends(get_db)):

    query = db.query(GitHubEvent)

    unique_actors_count = (
    db.query(GitHubEvent.actor)
    .filter(GitHubEvent.actor.isnot(None))
    .distinct()
    .count()
)

    return {
        "total_events": query.count(),
        "total_repositories": db.query(GitHubEvent.repo_name).distinct().count(),
        "total_unique_actors": unique_actors_count,
        "total_members": query.filter(GitHubEvent.event_type == "member").count(),
        "total_issues": query.filter(GitHubEvent.event_type == "issues").count(),
        "total_pull requests": query.filter(GitHubEvent.event_type == "pull_request").count(),
        "total_pushes": query.filter(GitHubEvent.event_type == "push").count(),
        "total_workflows": query.filter(GitHubEvent.event_type == "workflow_run").count(),
    }
    
# Shows queriable log of events 
@app.get("/summary/events")
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

# Summarizes workflow runs for a repository by result
@app.get("/summary/events/workflow-runs")
def get_workflow_runs(
    repo_name: str,
    result: str,
    db: Session = Depends(get_db)
):
    if result not in {"success", "failure"}:
        raise HTTPException(
            status_code=400,
            detail="result must be 'success' or 'failure'",
        )
    
    base_query = db.query(GitHubEvent).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.repo_name == repo_name,
    )

    total_workflows = base_query.count()

    successful_workflows_count = base_query.filter(
        GitHubEvent.conclusion == "success"
    ).count()

    success_rate = (
        successful_workflows_count / total_workflows * 100
        if total_workflows > 0
        else 0
    )

    success_rate = round(success_rate, 2)

    workflows = (
        base_query
        .filter(GitHubEvent.conclusion == result)
        .order_by(GitHubEvent.created_at.desc())
        .all()
    )

    return {
        "repo_name": repo_name,
        "result": result,
        "total_workflows": total_workflows,
        "success_rate": success_rate,
        "count": len(workflows),
        "workflows": workflows,
    }

# Shows a limited amout of recent events
@app.get("/summary/events/recent")
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

# Summarizes all events by repo and show success/failures
@app.get("/summary/repository")
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

# Summary of events triggered by specific user actions
@app.get("/summary/{actor}")
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

