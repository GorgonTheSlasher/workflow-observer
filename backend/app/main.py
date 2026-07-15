import asyncio
import json

import jwt as pyjwt
from datetime import datetime, UTC, timedelta
from fastapi import FastAPI, Request, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.broadcaster import broadcaster
from app.config import settings
from app.database import get_db, SessionLocal
from app.event_dispatcher import dispatch_github_webhook
from app.models import GitHubEvent, UserAccount
from app.services.analytic_services import get_filtered_events, get_timeline, get_top_actors, get_event_type_breakdown, get_workflow_failures_by_name, get_workflow_failures_by_branch, get_workflow_run_timeline, get_workflow_execution_times, get_pr_cycle_times, get_dora_metrics, get_issue_stats, get_issue_activity_timeline, get_issue_labels, get_issue_resolution_trend, get_issue_reporters
from app.services.auth_services import register_new_user, user_login, get_current_user, get_github_authorize_url, login_with_github
from app.services.installation_services import get_user_installation_ids
from app.services.alert_rule_services import get_rules_for_user, create_rule, update_rule, delete_rule, toggle_rule
from app.schemas import AuthCredentials, AlertRuleCreate, AlertRuleUpdate, AlertRuleResponse

from app.alerts import send_slack_alert, format_test_alert

def _parse_date(s: str | None) -> datetime | None:
    if s is None:
        return None
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=UTC)

def _parse_end_date(s: str | None) -> datetime | None:
    """End date is exclusive upper bound — advance to start of next day."""
    if s is None:
        return None
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=UTC) + timedelta(days=1)


app = FastAPI(
    title="GitHub Workflow Observer",
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
        db=db,
        secret=settings.GITHUB_WEBHOOK_SECRET,
    )

# Webhook director for events delivered by the GitHub App's own installations. Verifies against the App's webhook secret and captures installation_id.
@app.post("/webhook/github-app")
async def github_app_webhook(
    request: Request,
    x_github_event: str = Header(None),
    x_hub_signature_256: str = Header(None),
    db: Session = Depends(get_db)
):

    return await dispatch_github_webhook(
        request=request,
        x_github_event=x_github_event,
        x_hub_signature_256=x_hub_signature_256,
        db=db,
        secret=settings.GITHUB_APP_WEBHOOK_SECRET,
    )

# Summarize all of the database
@app.get("/summary")
def summarize_db(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):

    installation_ids = get_user_installation_ids(current_user["id"], db)

    query = db.query(GitHubEvent)
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    unique_actors_query = db.query(GitHubEvent.actor).filter(GitHubEvent.actor.isnot(None))
    if installation_ids is not None:
        unique_actors_query = unique_actors_query.filter(GitHubEvent.installation_id.in_(installation_ids))
    unique_actors_count = unique_actors_query.distinct().count()

    repositories_query = db.query(GitHubEvent.repo_name)
    if installation_ids is not None:
        repositories_query = repositories_query.filter(GitHubEvent.installation_id.in_(installation_ids))

    return {
        "total_events": query.count(),
        "total_repositories": repositories_query.distinct().count(),
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
    installation_ids = get_user_installation_ids(current_user["id"], db)

    query = db.query(GitHubEvent.repo_name).filter(GitHubEvent.repo_name.isnot(None))
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    rows = query.distinct().order_by(GitHubEvent.repo_name).all()

    return [repo_name for (repo_name,) in rows]
    
# Shows queriable log of events 
@app.get("/summary/events")
def get_events(
    event_type: str | None = None,
    repo_name: str | None = None,
    actor: str | None = None,
    conclusion: str | None = None,
    branch: str | None = None,
    workflow_name: str | None = None,
    search: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
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
        branch=branch,
        workflow_name=workflow_name,
        search=search,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        limit=limit,
        offset=offset,
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

# Summarizes workflow runs for a repository by result
@app.get("/summary/events/workflow-runs")
def get_workflow_runs(
    repo_name: str | None = None,
    result: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if result not in {"success", "failure"}:
        raise HTTPException(
            status_code=400,
            detail="result must be 'success' or 'failure'",
        )

    installation_ids = get_user_installation_ids(current_user["id"], db)

    base_query = db.query(GitHubEvent).filter(
        GitHubEvent.event_type == "workflow_run",
    )
    if installation_ids is not None:
        base_query = base_query.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        base_query = base_query.filter(GitHubEvent.repo_name == repo_name)
    parsed_start = _parse_date(start_date)
    parsed_end = _parse_end_date(end_date)
    if parsed_start is not None:
        base_query = base_query.filter(GitHubEvent.created_at >= parsed_start)
    if parsed_end is not None:
        base_query = base_query.filter(GitHubEvent.created_at < parsed_end)

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
    installation_ids = get_user_installation_ids(current_user["id"], db)

    query = db.query(GitHubEvent)
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    return (
        query
        .order_by(GitHubEvent.created_at.desc())
        .limit(limit)
        .all()
    )

@app.get("/summary/top-actors")
def get_top_actors_summary(
    repo_name: str | None = None,
    limit: int = 5,
    start_date: str | None = None,
    end_date: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_top_actors(
        db=db,
        repo_name=repo_name,
        limit=limit,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        event_type=event_type,
        actor=actor,
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/events/by-type")
def get_event_type_breakdown_summary(
    repo_name: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_event_type_breakdown(
        db=db,
        repo_name=repo_name,
        event_type=event_type,
        actor=actor,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/workflow-failures-by-name")
def get_workflow_failures_by_name_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_failures_by_name(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/workflow-failures-by-branch")
def get_workflow_failures_by_branch_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_failures_by_branch(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/pr-cycle-times")
def get_pr_cycle_times_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_pr_cycle_times(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/dora")
def get_dora_metrics_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_dora_metrics(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/workflow-execution-times")
def get_workflow_execution_times_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_execution_times(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/workflow-runs/timeline")
def get_workflow_run_timeline_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_workflow_run_timeline(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/timeline")
def get_event_timeline(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_timeline(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/issues/stats")
def get_issue_stats_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_issue_stats(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/issues/activity")
def get_issue_activity_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_issue_activity_timeline(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/issues/labels")
def get_issue_labels_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_issue_labels(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/issues/resolution-trend")
def get_issue_resolution_trend_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_issue_resolution_trend(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/summary/issues/reporters")
def get_issue_reporters_summary(
    repo_name: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_issue_reporters(
        db=db,
        repo_name=repo_name,
        start_date=_parse_date(start_date),
        end_date=_parse_end_date(end_date),
        installation_ids=get_user_installation_ids(current_user["id"], db),
    )

@app.get("/events/stream")
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

# Route for debugging without having to push to test repo
@app.post("/test-alert")
def test_alert(current_user: dict = Depends(get_current_user)):
    send_slack_alert(format_test_alert())
    return {"success": True}


# ── Alert Rules ───────────────────────────────────────────────────────────────

@app.get("/settings/alert-rules", response_model=list[AlertRuleResponse])
def list_alert_rules(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_rules_for_user(current_user["id"], db)


@app.post("/settings/alert-rules", response_model=AlertRuleResponse, status_code=201)
def create_alert_rule(
    body: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return create_rule(current_user["id"], body, db)


@app.patch("/settings/alert-rules/{rule_id}", response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: int,
    body: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return update_rule(rule_id, current_user["id"], body, db)


@app.patch("/settings/alert-rules/{rule_id}/toggle", response_model=AlertRuleResponse)
def toggle_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return toggle_rule(rule_id, current_user["id"], db)


@app.delete("/settings/alert-rules/{rule_id}", status_code=204)
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    delete_rule(rule_id, current_user["id"], db)


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

# Redirects the browser to GitHub's authorization screen (GitHub App, consolidated login + install)
@app.get("/auth/github/login")
def github_login():
    return RedirectResponse(get_github_authorize_url())

# GitHub redirects back here with a one-time code, and an installation_id if this came from an install
@app.get("/github-app/auth")
def github_app_auth(code: str, installation_id: int | None = None, db: Session = Depends(get_db)):
    token = login_with_github(code=code, db=db, installation_id=installation_id)

    return RedirectResponse(f"{settings.FRONTEND_BASE_URL}/?token={token}")

#=======================Debug===========================#

@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

#=======================================================#