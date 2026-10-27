import hmac
import hashlib

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import GitHubEvent

def verify_signature(payload_body: bytes, signature_header: str, secret: str) -> None:

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

def get_event_by_delivery_id(db: Session, delivery_id: str) -> GitHubEvent | None:

    '''Looks up an already-processed webhook by its X-GitHub-Delivery GUID'''

    return db.query(GitHubEvent).filter(GitHubEvent.delivery_id == delivery_id).first()

def save_event(
    db: Session,
    event_type: str,
    data: dict[str, object],
    installation_id: int | None = None,
    delivery_id: str | None = None,
) -> GitHubEvent:

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
        installation_id=installation_id,
        delivery_id=delivery_id,
    )

    db.add(event)
    db.commit()
    db.refresh(event)    

    return event