from app.config import settings

import hmac
import hashlib
import os
from fastapi import FastAPI, Request, Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db

from app.models import GitHubEvent

secret = settings.GITHUB_WEBHOOK_SECRET

def verify_signature(payload_body: bytes, signature_header: str):

    '''Checks if there is a signature header (encoded webhook secret from github webhook) and 
    compares it to an encoded version of the webhook secret stored in .env accesses via settings import'''

    if not signature_header:
        raise HTTPException(status_code=403, detail="Missing signature")

    expected_signature = "sha256=" + hmac.new(
        secret.encode(),
        payload_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")
    
def save_event(db, event_type: str, data: dict):

    '''Filters data from github event to match db model and saves it to the database'''

    event = GitHubEvent(
        event_type=event_type,
        repo_name=data.get("repo_name"),
        branch=data.get("branch"),
        actor=data.get("actor") or data.get("author"),
        status=data.get("status"),
        conclusion=data.get("conclusion"),
        commit_sha=data.get("commit_sha"),
        html_url=data.get("html_url")
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
    db: Session = Depends(get_db),
):
    query = db.query(GitHubEvent)

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if conclusion:
        query = query.filter(GitHubEvent.conclusion == conclusion)

    return query.order_by(GitHubEvent.created_at.desc()).all()