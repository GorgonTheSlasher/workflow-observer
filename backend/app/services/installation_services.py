from sqlalchemy.orm import Session
from app.config import settings
from app.models import Installation, GitHubEvent


def link_installation(
    installation_id: int,
    user_id: int,
    db: Session,
    account_login: str | None = None,
) -> Installation:

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

    if account_login:
        existing.account_login = account_login

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


def get_own_installation_ids(user_id: int, db: Session) -> list[int]:

    '''Returns the GitHub installation_ids linked to a user'''

    rows = db.query(Installation.github_installation_id).filter(
        Installation.user_id == user_id
    ).all()

    return [row[0] for row in rows]


def get_user_installation_ids(user_id: int, db: Session) -> list[int]:

    '''Returns the installation_ids whose events a user may see: their own, or the configured
    demo tenant if they have none. Always a list, so callers always filter. An empty list
    (no installs, no demo configured) correctly shows nothing rather than every tenant.'''

    return get_own_installation_ids(user_id, db) or list(settings.DEMO_INSTALLATION_IDS)


def is_viewing_demo_data(user_id: int, db: Session) -> bool:

    '''True when the user's dashboard is showing the demo tenant instead of their own data'''

    return bool(settings.DEMO_INSTALLATION_IDS) and not get_own_installation_ids(user_id, db)
