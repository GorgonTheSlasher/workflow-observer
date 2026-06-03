from app.database import Base, engine
from app.models import GitHubEvent # noqa: F401

def init_db() -> None:
    Base.metadata.create_all(bind=engine)