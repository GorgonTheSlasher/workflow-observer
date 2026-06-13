import hmac
import hashlib
from collections import defaultdict
from datetime import datetime, UTC, timedelta

from fastapi import HTTPException, Depends
from sqlalchemy import String, cast, func, or_
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

def get_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    date_col = func.substr(cast(GitHubEvent.created_at, String), 1, 10).label('date')

    query = db.query(date_col, GitHubEvent.event_type, func.count().label('count'))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(date_col, GitHubEvent.event_type)
        .order_by(date_col)
        .all()
    )

    pivot: dict[str, dict[str, int]] = defaultdict(
        lambda: {et: 0 for et in _TIMELINE_EVENT_TYPES}
    )

    for date, event_type, count in rows:
        if event_type in _TIMELINE_EVENT_TYPES:
            pivot[date][event_type] = count

    return [{"date": date, **counts} for date, counts in sorted(pivot.items())]