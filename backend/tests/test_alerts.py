from unittest.mock import MagicMock, patch

from app.alerts import (
    _is_force_push_to_main,
    _is_new_member,
    _is_workflow_failure,
    get_alerts_for_event,
)


# ── Condition checkers ────────────────────────────────────────────────────────

def test_is_workflow_failure_requires_completed_status():
    assert _is_workflow_failure("workflow_run", {"status": "in_progress", "conclusion": "failure"}) is False
    assert _is_workflow_failure("workflow_run", {"status": "completed", "conclusion": "failure"}) is True
    assert _is_workflow_failure("push", {"status": "completed", "conclusion": "failure"}) is False


def test_is_force_push_to_main():
    assert _is_force_push_to_main("push", {"branch": "main", "details_json": {"forced": True}}) is True
    assert _is_force_push_to_main("push", {"branch": "master", "details_json": {"forced": True}}) is True
    assert _is_force_push_to_main("push", {"branch": "feature/x", "details_json": {"forced": True}}) is False
    assert _is_force_push_to_main("push", {"branch": "main", "details_json": {"forced": False}}) is False
    assert _is_force_push_to_main("workflow_run", {"branch": "main", "details_json": {"forced": True}}) is False


def test_is_new_member():
    assert _is_new_member("member", {"action": "added"}) is True
    assert _is_new_member("member", {"action": "removed"}) is False
    assert _is_new_member("push", {"action": "added"}) is False


# ── get_alerts_for_event helpers ──────────────────────────────────────────────

def _make_rule(rule_type, repo_filter=None, webhook_url=None):
    rule = MagicMock()
    rule.rule_type = rule_type
    rule.repo_filter = repo_filter
    rule.webhook_url = webhook_url
    rule.enabled = True
    return rule


def _make_saved_event(installation_id=None):
    evt = MagicMock()
    evt.id = 1
    evt.installation_id = installation_id
    return evt


def _make_db(rules):
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = rules
    return db


# ── Rule-based dispatch ───────────────────────────────────────────────────────

@patch("app.alerts._get_user_id_for_installation", return_value=42)
def test_failure_rule_fires_for_matching_event(_):
    rule = _make_rule("workflow_failure", repo_filter="org/repo")
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(99), _make_db([rule]))
    assert len(results) == 1
    payload, wh = results[0]
    assert "attachments" in payload
    assert wh is None


@patch("app.alerts._get_user_id_for_installation", return_value=42)
def test_repo_filter_blocks_wrong_repo(_):
    rule = _make_rule("workflow_failure", repo_filter="org/other-repo")
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(99), _make_db([rule]))
    assert results == []


@patch("app.alerts._get_user_id_for_installation", return_value=42)
def test_null_repo_filter_matches_any_repo(_):
    rule = _make_rule("workflow_failure", repo_filter=None)
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/any-repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(99), _make_db([rule]))
    assert len(results) == 1


@patch("app.alerts._get_user_id_for_installation", return_value=42)
def test_custom_webhook_url_forwarded(_):
    rule = _make_rule("workflow_failure", webhook_url="https://hooks.slack.com/custom")
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(99), _make_db([rule]))
    assert len(results) == 1
    _, wh = results[0]
    assert wh == "https://hooks.slack.com/custom"


@patch("app.alerts._get_user_id_for_installation", return_value=42)
def test_no_rules_returns_empty(_):
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(99), _make_db([]))
    assert results == []


@patch("app.alerts._get_user_id_for_installation", return_value=42)
def test_wrong_rule_type_does_not_fire(_):
    rule = _make_rule("force_push")
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(99), _make_db([rule]))
    assert results == []


def test_no_installation_id_uses_legacy_global_path():
    """Non-App webhooks fall back to firing alerts without consulting Alert_Rules."""
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "org/repo"}
    saved = _make_saved_event(installation_id=None)
    results = get_alerts_for_event("workflow_run", event_data, saved, MagicMock())
    assert len(results) == 1
    payload, wh = results[0]
    assert "attachments" in payload
    assert wh is None


@patch("app.alerts._get_user_id_for_installation", return_value=None)
def test_unlinked_installation_sends_no_alerts(_):
    """An App installation nobody has linked must not fall back to the owner's global Slack."""
    event_data = {"status": "completed", "conclusion": "failure", "repo_name": "stranger/repo"}
    results = get_alerts_for_event("workflow_run", event_data, _make_saved_event(installation_id=123), MagicMock())
    assert results == []
