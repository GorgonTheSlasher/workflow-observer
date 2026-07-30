from datetime import datetime
from pydantic import BaseModel


class AuthCredentials(BaseModel):
    email: str
    password: str


# ── Alert Rules ───────────────────────────────────────────────────────────────

VALID_RULE_TYPES = {"workflow_failure", "workflow_recovery", "force_push", "new_member"}


class AlertRuleCreate(BaseModel):
    rule_type: str
    repo_filter: str | None = None  # None = match all repos
    webhook_url: str | None = None  # None = use global SLACK_WEBHOOK_URL
    enabled: bool = True

    def model_post_init(self, __context):
        if self.rule_type not in VALID_RULE_TYPES:
            raise ValueError(f"rule_type must be one of: {', '.join(sorted(VALID_RULE_TYPES))}")
        if self.repo_filter is not None and not self.repo_filter.strip():
            raise ValueError("repo_filter cannot be blank; omit it to match all repos")
        if self.webhook_url is not None and not self.webhook_url.strip():
            raise ValueError("webhook_url cannot be blank; omit it to use the global webhook")


class AlertRuleUpdate(BaseModel):
    repo_filter: str | None = None
    webhook_url: str | None = None
    enabled: bool | None = None


class AlertRuleResponse(BaseModel):
    id: int
    user_id: int
    rule_type: str
    repo_filter: str | None
    webhook_url: str | None
    enabled: bool
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True