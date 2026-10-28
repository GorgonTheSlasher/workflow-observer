from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import Settings
from app.schemas import AlertRuleCreate, AlertRuleUpdate, LoginCredentials, RegisterCredentials
from app.services.auth_services import login_with_github, find_user_installation


# ── Alert rule webhook URL (SSRF) ─────────────────────────────────────────────

def test_accepts_slack_webhook_url():
    rule = AlertRuleCreate(rule_type="workflow_failure", webhook_url="https://hooks.slack.com/services/T/B/X")
    assert rule.webhook_url == "https://hooks.slack.com/services/T/B/X"


def test_webhook_url_is_optional():
    assert AlertRuleCreate(rule_type="workflow_failure").webhook_url is None


@pytest.mark.parametrize("url", [
    "http://hooks.slack.com/services/T/B/X",          # not https
    "https://evil.example.com/hook",                   # wrong host
    "https://hooks.slack.com.evil.example.com/x",      # lookalike host
    "https://hooks.slack.com@evil.example.com/x",      # userinfo trick
    "https://hooks.slack.com:8080/services/x",         # non-default port
    "http://169.254.169.254/latest/meta-data/",        # cloud metadata endpoint
    "   ",
])
def test_rejects_non_slack_webhook_urls(url):
    with pytest.raises(ValidationError):
        AlertRuleCreate(rule_type="workflow_failure", webhook_url=url)
    with pytest.raises(ValidationError):
        AlertRuleUpdate(webhook_url=url)


def test_update_can_clear_webhook_url():
    update = AlertRuleUpdate(webhook_url=None)
    assert "webhook_url" in update.model_fields_set
    assert update.webhook_url is None


# ── Installation ownership check ──────────────────────────────────────────────

def _response(json_body, ok=True, links=None):
    response = MagicMock()
    response.ok = ok
    response.json.return_value = json_body
    response.links = links or {}
    return response


def test_find_user_installation_found():
    with patch("app.services.auth_services.requests.get") as mock_get:
        mock_get.return_value = _response({"installations": [{"id": 1}, {"id": 42, "account": {"login": "acme"}}]})
        assert find_user_installation("token", 42) == {"id": 42, "account": {"login": "acme"}}


def test_find_user_installation_not_found():
    with patch("app.services.auth_services.requests.get") as mock_get:
        mock_get.return_value = _response({"installations": [{"id": 1}]})
        assert find_user_installation("token", 42) is None


def test_find_user_installation_follows_pagination():
    with patch("app.services.auth_services.requests.get") as mock_get:
        mock_get.side_effect = [
            _response(
                {"installations": [{"id": 1}]},
                links={"next": {"url": "https://api.github.com/user/installations?page=2"}},
            ),
            _response({"installations": [{"id": 42}]}),
        ]
        assert find_user_installation("token", 42) == {"id": 42}
        assert mock_get.call_count == 2


def test_find_user_installation_api_error():
    with patch("app.services.auth_services.requests.get") as mock_get:
        mock_get.return_value = _response({}, ok=False)
        assert find_user_installation("token", 42) is None


def test_login_with_github_rejects_forged_installation_id():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = MagicMock(id=7, is_active=True)

    with patch("app.services.auth_services.requests.post") as mock_post, \
         patch("app.services.auth_services.requests.get") as mock_get, \
         patch("app.services.auth_services.link_installation") as mock_link:
        mock_post.return_value = _response({"access_token": "gh-token"})
        mock_get.side_effect = [
            _response({"id": 100, "login": "attacker"}),   # GET /user
            _response({"installations": [{"id": 1}]}),      # GET /user/installations
        ]

        with pytest.raises(HTTPException) as exc:
            login_with_github(code="code", db=db, installation_id=999)

        assert exc.value.status_code == 403
        mock_link.assert_not_called()


# ── Credentials ───────────────────────────────────────────────────────────────

def test_register_normalizes_email():
    creds = RegisterCredentials(email="  Dev@Example.COM ", password="long-enough")
    assert creds.email == "dev@example.com"


@pytest.mark.parametrize("email", ["not-an-email", "missing@tld", "@example.com", ""])
def test_register_rejects_invalid_email(email):
    with pytest.raises(ValidationError):
        RegisterCredentials(email=email, password="long-enough")


@pytest.mark.parametrize("password", ["", "short", "x" * 7, "x" * 129])
def test_register_rejects_bad_password_length(password):
    with pytest.raises(ValidationError):
        RegisterCredentials(email="dev@example.com", password=password)


def test_login_does_not_enforce_register_rules():
    # Lets an account created before the rules existed still log in; a wrong one just gets 401
    creds = LoginCredentials(email="Dev@Example.com", password="short")
    assert creds.email == "dev@example.com"


# ── Startup config check ──────────────────────────────────────────────────────

@pytest.mark.parametrize("secret", [None, "", "too-short"])
def test_settings_rejects_missing_or_weak_jwt_secret(secret):
    config = Settings()
    config.JWT_SECRET = secret
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        config.validate()


def test_settings_accepts_strong_jwt_secret():
    config = Settings()
    config.JWT_SECRET = "x" * 32
    config.validate()
