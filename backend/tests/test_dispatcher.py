import json
import pytest
from fastapi import BackgroundTasks
from sqlalchemy.exc import IntegrityError

from app.event_dispatcher import dispatch_github_webhook


class FakeRequest:
    def __init__(self, payload: dict):
        self._body = json.dumps(payload).encode("utf-8")

    async def body(self):
        return self._body


class FakeSavedEvent:
    id = 123
    installation_id = None


class FakeDb:
    def __init__(self):
        self.rolled_back = False

    def rollback(self):
        self.rolled_back = True


PUSH_PAYLOAD = {
    "ref": "refs/heads/main",
    "after": "abc123",
    "repository": {"full_name": "john/test-repo"},
    "pusher": {"name": "John"},
    "sender": {"login": "john"},
    "commits": [],
}


@pytest.fixture
def no_signature_check(monkeypatch):
    monkeypatch.setattr("app.event_dispatcher.verify_signature", lambda *args: None)


@pytest.mark.anyio
async def test_dispatch_push_event(monkeypatch, no_signature_check):
    def fake_save_event(db, event_type, data, installation_id=None, delivery_id=None):
        return FakeSavedEvent()

    monkeypatch.setattr("app.event_dispatcher.save_event", fake_save_event)

    result = await dispatch_github_webhook(
        request=FakeRequest(PUSH_PAYLOAD),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
        background_tasks=BackgroundTasks(),
    )

    assert result["success"] is True
    assert result["event"] == "push"
    assert result["saved_event_id"] == 123
    assert result["result"]["event_type"] == "push"
    assert result["result"]["branch"] == "main"


@pytest.mark.anyio
async def test_dispatch_captures_installation_id(monkeypatch, no_signature_check):
    captured = {}

    def fake_save_event(db, event_type, data, installation_id=None, delivery_id=None):
        captured["installation_id"] = installation_id
        return FakeSavedEvent()

    monkeypatch.setattr("app.event_dispatcher.save_event", fake_save_event)

    result = await dispatch_github_webhook(
        request=FakeRequest({**PUSH_PAYLOAD, "installation": {"id": 999}}),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
        background_tasks=BackgroundTasks(),
    )

    assert result["success"] is True
    assert captured["installation_id"] == 999


# ── Delivery deduplication ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_dispatch_skips_already_processed_delivery(monkeypatch, no_signature_check):
    saved = []

    monkeypatch.setattr("app.event_dispatcher.get_event_by_delivery_id", lambda db, delivery_id: FakeSavedEvent())
    monkeypatch.setattr("app.event_dispatcher.save_event", lambda **kwargs: saved.append(kwargs))

    result = await dispatch_github_webhook(
        request=FakeRequest(PUSH_PAYLOAD),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
        background_tasks=BackgroundTasks(),
        x_github_delivery="guid-1",
    )

    assert result["success"] is True
    assert result["duplicate"] is True
    assert result["delivery_id"] == "guid-1"
    assert saved == []


@pytest.mark.anyio
async def test_dispatch_stores_delivery_id(monkeypatch, no_signature_check):
    captured = {}

    def fake_save_event(db, event_type, data, installation_id=None, delivery_id=None):
        captured["delivery_id"] = delivery_id
        return FakeSavedEvent()

    monkeypatch.setattr("app.event_dispatcher.get_event_by_delivery_id", lambda db, delivery_id: None)
    monkeypatch.setattr("app.event_dispatcher.save_event", fake_save_event)

    result = await dispatch_github_webhook(
        request=FakeRequest(PUSH_PAYLOAD),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
        background_tasks=BackgroundTasks(),
        x_github_delivery="guid-2",
    )

    assert result["success"] is True
    assert "duplicate" not in result
    assert captured["delivery_id"] == "guid-2"


@pytest.mark.anyio
async def test_dispatch_treats_unique_violation_as_duplicate(monkeypatch, no_signature_check):
    def fake_save_event(**kwargs):
        raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed"))

    monkeypatch.setattr("app.event_dispatcher.get_event_by_delivery_id", lambda db, delivery_id: None)
    monkeypatch.setattr("app.event_dispatcher.save_event", fake_save_event)

    db = FakeDb()
    result = await dispatch_github_webhook(
        request=FakeRequest(PUSH_PAYLOAD),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=db,
        secret="test-secret",
        background_tasks=BackgroundTasks(),
        x_github_delivery="guid-3",
    )

    assert result["duplicate"] is True
    assert db.rolled_back is True


# ── Slack alerts run in the background ────────────────────────────────────────

@pytest.mark.anyio
async def test_dispatch_queues_slack_alerts_instead_of_sending_inline(monkeypatch, no_signature_check):
    sent = []

    monkeypatch.setattr("app.event_dispatcher.save_event", lambda **kwargs: FakeSavedEvent())
    monkeypatch.setattr(
        "app.event_dispatcher.get_alerts_for_event",
        lambda *args: [({"text": "alert"}, "https://hooks.slack.com/services/x")],
    )
    monkeypatch.setattr("app.event_dispatcher.send_slack_alert", lambda payload, url: sent.append(url))

    background_tasks = BackgroundTasks()
    await dispatch_github_webhook(
        request=FakeRequest(PUSH_PAYLOAD),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
        background_tasks=background_tasks,
    )

    # Nothing is sent during the request, the alert is queued for after the response
    assert sent == []
    assert len(background_tasks.tasks) == 1

    await background_tasks()
    assert sent == ["https://hooks.slack.com/services/x"]


@pytest.mark.anyio
async def test_dispatch_invalidates_cached_analytics_for_the_installation(monkeypatch, no_signature_check):
    invalidated = []
    monkeypatch.setattr("app.event_dispatcher.save_event", lambda **kwargs: FakeSavedEvent())
    monkeypatch.setattr("app.event_dispatcher.get_alerts_for_event", lambda *args: [])
    monkeypatch.setattr("app.event_dispatcher.analytics_cache.invalidate_installation", invalidated.append)

    await dispatch_github_webhook(
        request=FakeRequest({**PUSH_PAYLOAD, "installation": {"id": 999}}),
        x_github_event="push",
        x_hub_signature_256="fake-signature",
        db=None,
        secret="test-secret",
        background_tasks=BackgroundTasks(),
    )

    assert invalidated == [999]
