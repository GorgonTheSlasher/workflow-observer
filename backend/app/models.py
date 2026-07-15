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
    installation_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True)

    email = Column(String, unique=True, nullable=True)
    hashed_pass = Column(String, nullable=True)
    github_id = Column(Integer, unique=True, nullable=True)
    github_username = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

class Installation(Base):
    __tablename__ = "installations"
    id = Column(Integer, primary_key=True)
    github_installation_id = Column(Integer, unique=True)
    user_id = Column(Integer, nullable=True)
    account_login = Column(String)

class Alert_Rules(Base):
    __tablename__ = "alert_rules"

    id      = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)

    # What kind of event triggers this rule
    # Values: workflow_failure | workflow_recovery | force_push | new_member
    rule_type = Column(String, nullable=False)

    # null = fire for all repos; a repo full_name scopes it to one repo
    repo_filter = Column(String, nullable=True)

    # Reserved for future threshold-based rules (e.g. high_failure_rate)
    threshold                = Column(Integer, nullable=True)
    threshold_window_minutes = Column(Integer, nullable=True)

    # null = fall back to global SLACK_WEBHOOK_URL env var
    # Set to route this rule to a specific channel
    webhook_url = Column(String, nullable=True)

    enabled = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))