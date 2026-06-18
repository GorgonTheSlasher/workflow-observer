import hmac
import hashlib
from collections import defaultdict
from datetime import datetime, UTC, timedelta

from fastapi import HTTPException, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import GitHubEvent

secret = settings.GITHUB_WEBHOOK_SECRET

def verify_signature(payload_body: bytes, signature_header: str) -> None:

    '''Checks if there is a signature header (encoded webhook secret from github webhook) and 
    compares it to an encoded version of the webhook secret stored in .env accesses via settings import'''

    if secret is None:
        raise HTTPException(status_code=500, detail="Secret for webhook cannot be None")

    if not signature_header:
        raise HTTPException(status_code=403, detail="Missing signature")

    expected_signature = "sha256=" + hmac.new(
        secret.encode(),
        payload_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")
    
def save_event(db: Session, event_type: str, data: dict[str, object]) -> GitHubEvent:

    '''Filters data from github event to match db model and saves it to the database'''

    event = GitHubEvent(
        event_type=event_type,
        action=data.get("action"),
        repo_name=data.get("repo_name"),
        branch=data.get("branch"),
        actor=data.get("actor") or data.get("author"),
        status=data.get("status"),
        conclusion=data.get("conclusion"),
        commit_sha=data.get("commit_sha"),
        html_url=data.get("html_url"),
        details_json=data.get("details_json"),
    )

    db.add(event)
    db.commit()
    db.refresh(event)    

    return event

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
) -> dict:

    query = db.query(GitHubEvent)

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

_WORKFLOW_CONCLUSIONS = ["success", "failure", "cancelled", "skipped"]

def get_failure_trend(
    repo_name: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    now = datetime.now(UTC)
    current_start = now - timedelta(days=14)
    prior_start = now - timedelta(days=28)

    def count_conclusions(start: datetime, end: datetime) -> dict[str, int]:
        query = db.query(GitHubEvent.conclusion).filter(
            GitHubEvent.event_type == "workflow_run",
            GitHubEvent.conclusion.isnot(None),
            GitHubEvent.created_at >= start,
            GitHubEvent.created_at < end,
        )
        if repo_name:
            query = query.filter(GitHubEvent.repo_name == repo_name)
        counts = {c: 0 for c in _WORKFLOW_CONCLUSIONS}
        for (conclusion,) in query.all():
            if conclusion in counts:
                counts[conclusion] += 1
        return counts

    current_counts = count_conclusions(current_start, now)
    prior_counts = count_conclusions(prior_start, current_start)

    current_total = sum(current_counts.values()) or 1
    prior_total = sum(prior_counts.values()) or 1

    return [
        {
            "conclusion": c,
            "current": round(current_counts[c] / current_total * 100, 1),
            "prior": round(prior_counts[c] / prior_total * 100, 1),
        }
        for c in _WORKFLOW_CONCLUSIONS
    ]

def get_top_actors(
    repo_name: str | None = None,
    limit: int = 5,
    since_days: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(
        GitHubEvent.actor,
        func.count(GitHubEvent.id).label("count"),
    ).filter(GitHubEvent.actor.isnot(None))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

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

def get_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(GitHubEvent.created_at, GitHubEvent.event_type)

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