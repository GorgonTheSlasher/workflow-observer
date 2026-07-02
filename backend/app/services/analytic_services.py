from collections import defaultdict
from datetime import datetime, UTC, timedelta

from fastapi import Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GitHubEvent


def get_filtered_events(
    event_type: str | None = None,
    repo_name: str | None = None,
    actor: str | None = None,
    conclusion: str | None = None,
    search: str | None = None,
    since_days: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> dict:

    query = db.query(GitHubEvent)

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if conclusion:
        query = query.filter(GitHubEvent.conclusion == conclusion)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                GitHubEvent.repo_name.ilike(pattern),
                GitHubEvent.actor.ilike(pattern),
                GitHubEvent.branch.ilike(pattern),
                GitHubEvent.commit_sha.ilike(pattern),
            )
        )

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    total = query.count()

    events = (
        query
        .order_by(GitHubEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {"total": total, "events": events}


_TIMELINE_EVENT_TYPES = ["push", "pull_request", "workflow_run", "issues", "member"]

def get_top_actors(
    repo_name: str | None = None,
    limit: int = 5,
    since_days: int | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(
        GitHubEvent.actor,
        func.count(GitHubEvent.id).label("count"),
    ).filter(GitHubEvent.actor.isnot(None))

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(GitHubEvent.actor)
        .order_by(func.count(GitHubEvent.id).desc())
        .limit(limit)
        .all()
    )

    return [{"actor": actor, "count": count} for actor, count in rows]

def get_event_type_breakdown(
    repo_name: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(
        GitHubEvent.event_type,
        func.count(GitHubEvent.id).label("count"),
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(GitHubEvent.event_type)
        .order_by(func.count(GitHubEvent.id).desc())
        .all()
    )

    return [{"event_type": event_type, "count": count} for event_type, count in rows]

def get_workflow_failures_by_name(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.details_json).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion == "failure",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    counts: dict[str, int] = defaultdict(int)
    for (details_json,) in query.all():
        workflow_run = (details_json or {}).get("workflow_run", {})
        name = workflow_run.get("name") or "Unknown"
        counts[name] += 1

    return [
        {"workflow_name": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

def get_workflow_failures_by_branch(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(
        GitHubEvent.branch,
        func.count(GitHubEvent.id).label("count"),
    ).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion == "failure",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(GitHubEvent.branch)
        .order_by(func.count(GitHubEvent.id).desc())
        .all()
    )

    return [{"branch": branch or "Unknown", "count": count} for branch, count in rows]

def get_workflow_run_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.created_at, GitHubEvent.conclusion).filter(
        GitHubEvent.event_type == "workflow_run",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    pivot: dict[str, dict[str, int]] = defaultdict(lambda: {"success": 0, "failure": 0, "other": 0})

    for created_at, conclusion in query.all():
        if created_at is None:
            continue
        date_str = created_at.strftime('%Y-%m-%d')
        if conclusion == "success":
            pivot[date_str]["success"] += 1
        elif conclusion == "failure":
            pivot[date_str]["failure"] += 1
        else:
            pivot[date_str]["other"] += 1

    return [{"date": date, **counts} for date, counts in sorted(pivot.items())]

def get_workflow_execution_times(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.details_json).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion.in_(["success", "failure"]),
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    durations: dict[str, list[float]] = defaultdict(list)

    for (details_json,) in query.all():
        workflow_run = (details_json or {}).get("workflow_run", {})
        name = workflow_run.get("name") or "Unknown"
        started_at = workflow_run.get("run_started_at")
        updated_at = workflow_run.get("updated_at")

        if not started_at or not updated_at:
            continue

        try:
            start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            duration_seconds = (end - start).total_seconds()
            if duration_seconds > 0:
                durations[name].append(duration_seconds)
        except (ValueError, AttributeError):
            continue

    return [
        {
            "workflow_name": name,
            "avg_seconds": round(sum(times) / len(times), 1),
            "run_count": len(times),
        }
        for name, times in sorted(
            durations.items(),
            key=lambda kv: sum(kv[1]) / len(kv[1]),
            reverse=True,
        )
    ]


def get_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.created_at, GitHubEvent.event_type)

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = query.all()

    pivot: dict[str, dict[str, int]] = defaultdict(
        lambda: {et: 0 for et in _TIMELINE_EVENT_TYPES}
    )

    for created_at, event_type in rows:
        if created_at is not None and event_type in _TIMELINE_EVENT_TYPES:
            date_str = created_at.strftime('%Y-%m-%d')
            pivot[date_str][event_type] += 1

    return [{"date": date, **counts} for date, counts in sorted(pivot.items())]