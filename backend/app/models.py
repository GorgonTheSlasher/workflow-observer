from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime, UTC

Base = declarative_base()

class GitHubEvent(Base):
    __tablename__ = "github_events"

    id = Column(Integer, primary_key=True)
    event_type = Column(String)
    repo_name = Column(String)
    branch = Column(String)
    actor = Column(String)
    status = Column(String, nullable=True)
    conclusion = Column(String, nullable=True)
    commit_sha = Column(String, nullable=True)
    html_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now(UTC))
