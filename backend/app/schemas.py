from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, field_validator


class AuthCredentials(BaseModel):
    email: str
    password: str


# ── Alert Rules ───────────────────────────────────────────────────────────────

VALID_RULE_TYPES = {"workflow_failure", "workflow_recovery", "force_push", "new_member"}

SLACK_WEBHOOK_HOST = "hooks.slack.com"


def validate_slack_webhook_url(url: str | None) -> str | None:
    '''The server POSTs to this URL, so only Slack incoming webhooks are allowed.
    Anything else would let a user make the backend send requests to arbitrary hosts (SSRF).'''
    if url is None:
        return None
    url = url.strip()
    if not url:
        raise ValueError("webhook_url cannot be blank; omit it to use the global webhook")
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != SLACK_WEBHOOK_HOST or parsed.port is not None:
        raise ValueError(f"webhook_url must be a Slack incoming webhook (https://{SLACK_WEBHOOK_HOST}/...)")
    return url


class AlertRuleCreate(BaseModel):
    rule_type: str
    repo_filter: str | None = None  # None = match all repos
    webhook_url: str | None = None  # None = use global SLACK_WEBHOOK_URL
    enabled: bool = True

    _check_webhook_url = field_validator("webhook_url")(validate_slack_webhook_url)

    def model_post_init(self, __context):
        if self.rule_type not in VALID_RULE_TYPES:
            raise ValueError(f"rule_type must be one of: {', '.join(sorted(VALID_RULE_TYPES))}")
        if self.repo_filter is not None and not self.repo_filter.strip():
            raise ValueError("repo_filter cannot be blank; omit it to match all repos")


class AlertRuleUpdate(BaseModel):
    repo_filter: str | None = None
    webhook_url: str | None = None
    enabled: bool | None = None

    _check_webhook_url = field_validator("webhook_url")(validate_slack_webhook_url)


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