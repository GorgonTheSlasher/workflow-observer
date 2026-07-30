import json
import pytest

from app.event_dispatcher import dispatch_github_webhook


class FakeRequest:
    def __init__(self, payload: dict):
        self._body = json.dumps(payload).encode("utf-8")

    async def body(self):
        return self._body


class FakeSavedEvent:
    id = 123
    installation_id = None


@pytest.mark.anyio
async def test_dispatch_push_event(monkeypatch):
    payload = {
        "ref": "refs/heads/main",
        "after": "abc123",
        "repository": {"full_name": "john/test-repo"},
        "pusher": {"name": "John"},
        "sender": {"login": "john"},
        "commits": [],
    }

    def fake_verify_signature(payload_body, signature_header, secret):
        return None

    def fake_save_event(db, event_type, data, installation_id=None):
        return FakeSavedEvent()

    monkeypatch.setattr(
        "app.event_dispatcher.verify_signature",
        fake_verify_signature,
    )
    monkeypatch.setattr(
        "app.event_dispatcher.save_event",
        fake_save_event,
    )

    result = await dispatch_github_webhook(
        request=FakeRequest(payload),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
    )

    assert result["success"] is True
    assert result["event"] == "push"
    assert result["saved_event_id"] == 123
    assert result["result"]["event_type"] == "push"
    assert result["result"]["branch"] == "main"


@pytest.mark.anyio
async def test_dispatch_captures_installation_id(monkeypatch):
    payload = {
        "ref": "refs/heads/main",
        "after": "abc123",
        "repository": {"full_name": "john/test-repo"},
        "pusher": {"name": "John"},
        "sender": {"login": "john"},
        "commits": [],
        "installation": {"id": 999},
    }

    captured = {}

    def fake_verify_signature(payload_body, signature_header, secret):
        return None

    def fake_save_event(db, event_type, data, installation_id=None):
        captured["installation_id"] = installation_id
        return FakeSavedEvent()

    monkeypatch.setattr(
        "app.event_dispatcher.verify_signature",
        fake_verify_signature,
    )
    monkeypatch.setattr(
        "app.event_dispatcher.save_event",
        fake_save_event,
    )

    result = await dispatch_github_webhook(
        request=FakeRequest(payload),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
    )

    assert result["success"] is True
    assert captured["installation_id"] == 999
