from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from datetime import datetime, UTC
from app.database import Base

class GitHubEvent(Base):
    __tablename__ = "github_events"

    id = Column(Integer, primary_key=True)

    event_type = Column(String)
    action = Column(String)

    repo_name = Column(String)
    actor = Column(String)
    branch = Column(String)

    status = Column(String, nullable=True)
    conclusion = Column(String, nullable=True)

    commit_sha = Column(String, nullable=True)
    html_url = Column(String, nullable=True)
    details_json = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True)

    email = Column(String, unique=True)
    hashed_pass = Column(String)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))