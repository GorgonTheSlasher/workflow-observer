from datetime import datetime
from pydantic import BaseModel


class AuthCredentials(BaseModel):
    email: str
    password: str


# ── Alert Rules ───────────────────────────────────────────────────────────────

VALID_RULE_TYPES = {"workflow_failure", "workflow_recovery", "force_push", "new_member"}


class AlertRuleCreate(BaseModel):
    rule_type: str
    repo_filter: str | None = None
    webhook_url: str | None = None
    enabled: bool = True

    def model_post_init(self, __context):
        if self.rule_type not in VALID_RULE_TYPES:
            raise ValueError(f"rule_type must be one of: {', '.join(sorted(VALID_RULE_TYPES))}")


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