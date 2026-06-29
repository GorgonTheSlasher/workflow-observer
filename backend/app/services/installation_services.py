from sqlalchemy.orm import Session
from app.models import Installation


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
