from sqlalchemy.orm import Session
from app.models import Installation, GitHubEvent


def link_installation(installation_id: int, user_id: int, db: Session) -> Installation:

    '''Finds or creates an Installation row for a given GitHub installation_id and attaches it to a user'''

    existing = db.query(Installation).filter(
        Installation.github_installation_id == installation_id
    ).first()

    if not existing:
        existing = Installation(
            github_installation_id=installation_id,
            user_id=user_id,
        )
        db.add(existing)
    else:
        existing.user_id = user_id

    db.commit()
    db.refresh(existing)

    return existing


def delete_installation(installation_id: int, db: Session) -> bool:
    '''Removes the Installation row and all associated events for a given GitHub installation_id. Returns True if a row was deleted.'''

    row = db.query(Installation).filter(
        Installation.github_installation_id == installation_id
    ).first()

    if not row:
        return False

    db.query(GitHubEvent).filter(
        GitHubEvent.installation_id == installation_id
    ).delete()

    db.delete(row)
    db.commit()
    return True


def get_user_installation_ids(user_id: int, db: Session) -> list[int] | None:

    '''Returns the GitHub installation_ids linked to a user, or None if they have none (caller should treat None as "no filter")'''

    rows = db.query(Installation.github_installation_id).filter(
        Installation.user_id == user_id
    ).all()

    ids = [row[0] for row in rows]

    return ids or None
