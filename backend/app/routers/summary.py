from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GitHubEvent
from app.services.analytic_services import (
    get_dora_metrics,
    get_event_type_breakdown,
    get_filtered_events,
    get_issue_activity_timeline,
    get_issue_labels,
    get_issue_reporters,
    get_issue_resolution_trend,
    get_issue_stats,
    get_pr_cycle_times,
    get_timeline,
    get_top_actors,
    get_workflow_execution_times,
    get_workflow_failures_by_branch,
    get_workflow_failures_by_name,
    get_workflow_run_timeline,
)
from app.services.auth_services import get_current_user
from app.services.installation_services import get_user_installation_ids

router = APIRouter(prefix="/summary", tags=["summary"])


def _parse_date(s: str | None) -> datetime | None:
    if s is None:
        return None
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=UTC)


def _parse_end_date(s: str | None) -> datetime | None:
    """End date is exclusive upper bound — advance to start of next day."""
    if s is None:
        return None
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=UTC) + timedelta(days=1)


@router.get("")
def summarize_db(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    installation_ids = get_user_installation_ids(current_user["id"], db)

    query = db.query(GitHubEvent)
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    unique_actors_query = db.query(GitHubEvent.actor).filter(GitHubEvent.actor.isnot(None))
    if installation_ids is not None:
        unique_actors_query = unique_actors_query.filter(
            GitHubEvent.installation_id.in_(installation_ids)
        )

    repositories_query = db.query(GitHubEvent.repo_name)
    if installation_ids is not None:
        repositories_query = repositories_query.filter(
            GitHubEvent.installation_id.in_(installation_ids)
        )

    return {
        "total_events": query.count(),
        "total_repositories": repositories_query.distinct().count(),
        "total_unique_actors": unique_actors_query.distinct().count(),
        "total_members": query.filter(GitHubEvent.event_type == "member").count(),
        "total_issues": query.filter(GitHubEvent.event_type == "issues").count(),
        "total_pull_requests": query.filter(GitHubEvent.event_type == "pull_request").count(),
        "total_pushes": query.filter(GitHubEvent.event_type == "push").count(),
        "total_workflows": query.filter(GitHubEvent.event_type == "workflow_run").count(),
    }


@router.get("/repositories")
def get_repositories(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    installation_ids = get_user_installation_ids(current_user["id"], db)

    query = db.query(GitHubEvent.repo_name).filter(GitHubEvent.repo_name.isnot(None))
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    rows = query.distinct().order_by(GitHubEvent.repo_name).all()
    return [repo_name for (repo_name,) in rows]


@router.get("/events")
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


@router.get("/events/workflow-runs")
def get_workflow_runs(
    repo_name: str | None = None,
    result: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if result not in {"success", "failure"}:
        raise HTTPException(status_code=400, detail="result must be 'success' or 'failure'")

    installation_ids = get_user_installation_ids(current_user["id"], db)

    base_query = db.query(GitHubEvent).filter(GitHubEvent.event_type == "workflow_run")
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
    successful_count = base_query.filter(GitHubEvent.conclusion == "success").count()
    success_rate = round(successful_count / total_workflows * 100, 2) if total_workflows > 0 else 0

    workflows = (
        base_query.filter(GitHubEvent.conclusion == result)
        .order_by(GitHubEvent.created_at.desc())
        .all()
    )

    workflow_items = []
    for wf in workflows:
        details_json = wf.details_json or {}
        workflow_run = details_json.get("workflow_run", {})
        workflow_items.append({
            "id": wf.id,
            "event_type": wf.event_type,
            "action": wf.action,
            "repo_name": wf.repo_name,
            "actor": wf.actor,
            "branch": wf.branch,
            "status": wf.status,
            "conclusion": wf.conclusion,
            "commit_sha": wf.commit_sha,
            "html_url": wf.html_url,
            "created_at": wf.created_at,
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


@router.get("/events/recent")
def get_recent_events(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    installation_ids = get_user_installation_ids(current_user["id"], db)

    query = db.query(GitHubEvent)
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    return query.order_by(GitHubEvent.created_at.desc()).limit(limit).all()


@router.get("/events/by-type")
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


@router.get("/top-actors")
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


@router.get("/timeline")
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


@router.get("/workflow-failures-by-name")
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


@router.get("/workflow-failures-by-branch")
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


@router.get("/pr-cycle-times")
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


@router.get("/dora")
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


@router.get("/workflow-execution-times")
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


@router.get("/workflow-runs/timeline")
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


@router.get("/issues/stats")
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


@router.get("/issues/activity")
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


@router.get("/issues/labels")
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


@router.get("/issues/resolution-trend")
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


@router.get("/issues/reporters")
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
