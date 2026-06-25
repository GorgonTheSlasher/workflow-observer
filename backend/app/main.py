from contextlib import asynccontextmanager
from datetime import datetime, UTC, timedelta
from fastapi import FastAPI, Request, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.event_dispatcher import dispatch_github_webhook
from app.init_db import init_db
from app.models import GitHubEvent
from app.services.analytic_services import get_filtered_events, get_timeline, get_top_actors, get_event_type_breakdown, get_workflow_failures_by_name, get_workflow_failures_by_branch, get_workflow_run_timeline
from app.services.auth_services import register_new_user, user_login, get_current_user, get_github_authorize_url, login_with_github
from app.schemas import AuthCredentials

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
        "https://workflow-observer.vercel.app",
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
def summarize_db(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):

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
        "total_pull_requests": query.filter(GitHubEvent.event_type == "pull_request").count(),
        "total_pushes": query.filter(GitHubEvent.event_type == "push").count(),
        "total_workflows": query.filter(GitHubEvent.event_type == "workflow_run").count(),
    }

# Lists repositories that have stored events
@app.get("/summary/repositories")
def get_repositories(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = (
        db.query(GitHubEvent.repo_name)
        .filter(GitHubEvent.repo_name.isnot(None))
        .distinct()
        .order_by(GitHubEvent.repo_name)
        .all()
    )

    return [repo_name for (repo_name,) in rows]
    
# Shows queriable log of events 
@app.get("/summary/events")
def get_events(
    event_type: str | None = None,
    repo_name: str | None = None,
    actor: str | None = None,
    conclusion: str | None = None,
    search: str | None = None,
    since_days: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_filtered_events(
        db=db,
        event_type=event_type,
        repo_name=repo_name,
        actor=actor,
        conclusion=conclusion,
        search=search,
        since_days=since_days,
        limit=limit,
        offset=offset,
    )

# Summarizes workflow runs for a repository by result
@app.get("/summary/events/workflow-runs")
def get_workflow_runs(
    repo_name: str | None = None,
    result: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if result not in {"success", "failure"}:
        raise HTTPException(
            status_code=400,
            detail="result must be 'success' or 'failure'",
        )

    base_query = db.query(GitHubEvent).filter(
        GitHubEvent.event_type == "workflow_run",
    )
    if repo_name:
        base_query = base_query.filter(GitHubEvent.repo_name == repo_name)
    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        base_query = base_query.filter(GitHubEvent.created_at >= cutoff)

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

    workflow_items = []

    for workflow in workflows:
        details_json = workflow.details_json or {}
        workflow_run = details_json.get("workflow_run", {})

        workflow_items.append({
            "id": workflow.id,
            "event_type": workflow.event_type,
            "action": workflow.action,
            "repo_name": workflow.repo_name,
            "actor": workflow.actor,
            "branch": workflow.branch,
            "status": workflow.status,
            "conclusion": workflow.conclusion,
            "commit_sha": workflow.commit_sha,
            "html_url": workflow.html_url,
            "created_at": workflow.created_at,
            "workflow_name": workflow_run.get("name"),
        })


    return {
        "repo_name": repo_name,
        "result": result,
        "total_workflows": total_workflows,
        "success_rate": success_rate,
        "count": len(workflows),
        "workflows": workflow_items,
    }

# Shows a limited amout of recent events
@app.get("/summary/events/recent")
def get_recent_events(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return (
        db.query(GitHubEvent)
        .order_by(GitHubEvent.created_at.desc())
        .limit(limit)
        .all()
    )

@app.get("/summary/top-actors")
def get_top_actors_summary(
    repo_name: str | None = None,
    limit: int = 5,
    since_days: int | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_top_actors(
        db=db,
        repo_name=repo_name,
        limit=limit,
        since_days=since_days,
        event_type=event_type,
        actor=actor,
    )

@app.get("/summary/events/by-type")
def get_event_type_breakdown_summary(
    repo_name: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_event_type_breakdown(
        db=db,
        repo_name=repo_name,
        event_type=event_type,
        actor=actor,
        since_days=since_days,
    )

@app.get("/summary/workflow-failures-by-name")
def get_workflow_failures_by_name_summary(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_failures_by_name(db=db, repo_name=repo_name, since_days=since_days)

@app.get("/summary/workflow-failures-by-branch")
def get_workflow_failures_by_branch_summary(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_failures_by_branch(db=db, repo_name=repo_name, since_days=since_days)

@app.get("/summary/workflow-runs/timeline")
def get_workflow_run_timeline_summary(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_run_timeline(db=db, repo_name=repo_name, since_days=since_days)

@app.get("/summary/timeline")
def get_event_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_timeline(db=db, repo_name=repo_name, since_days=since_days)

# Route for debugging without having to push to test repo
@app.post("/test-alert")
def test_alert(current_user: dict = Depends(get_current_user)):
    send_slack_alert("Test alert from Workflow Observer")
    return {"success": True}


@app.post("/auth/register")
def register_user(
    credentials: AuthCredentials,
    db: Session = Depends(get_db),
):
    return register_new_user(email=credentials.email, password=credentials.password, db=db)

@app.post("/auth/login")
def login_user(
    credentials: AuthCredentials,
    db: Session = Depends(get_db),
):
    token = user_login(email=credentials.email, password=credentials.password, db=db)

    return {"access_token": token, "token_type": "bearer"}

# Redirects the browser to GitHub's OAuth consent screen
@app.get("/auth/github/login")
def github_login():
    return RedirectResponse(get_github_authorize_url())

# GitHub redirects back here with a one-time code after the user approves access
@app.get("/auth/github/callback")
def github_callback(code: str, db: Session = Depends(get_db)):
    token = login_with_github(code=code, db=db)

    return RedirectResponse(f"{settings.FRONTEND_BASE_URL}/?token={token}")

#=======================Debug===========================#

@app.post("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

#=======================================================#