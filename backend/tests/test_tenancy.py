import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.cache import analytics_cache
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import GitHubEvent, Installation, UserAccount
from app.services.auth_services import _issue_jwt

MY_INSTALLATION = 111
OTHER_TENANT_INSTALLATION = 222
DEMO_INSTALLATION = 333


@pytest.fixture
def db_session(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET", "test-secret-that-is-at-least-32-bytes-long")
    monkeypatch.setattr(settings, "DEMO_INSTALLATION_IDS", [])
    analytics_cache.clear()  # each test builds a fresh DB with the same installation ids

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    for installation_id, repo in [
        (MY_INSTALLATION, "me/my-repo"),
        (OTHER_TENANT_INSTALLATION, "someone-else/private-repo"),
        (DEMO_INSTALLATION, "demo-org/demo-repo"),
    ]:
        session.add(GitHubEvent(event_type="push", repo_name=repo, actor="x", installation_id=installation_id))
    session.commit()

    app.dependency_overrides[get_db] = lambda: session
    yield session
    app.dependency_overrides.clear()
    session.close()


@pytest.fixture
def client(db_session):
    return TestClient(app)


def _make_user(db_session, installation_id=None, **kwargs) -> dict:
    user = UserAccount(**kwargs)
    db_session.add(user)
    db_session.commit()
    if installation_id is not None:
        db_session.add(Installation(github_installation_id=installation_id, user_id=user.id))
        db_session.commit()
    return {"Authorization": f"Bearer {_issue_jwt(user.id)}"}


def _repos(client, headers) -> list[str]:
    response = client.get("/summary/repositories", headers=headers)
    assert response.status_code == 200
    return response.json()


# ── Tenant isolation ──────────────────────────────────────────────────────────

def test_user_only_sees_their_own_installation(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_INSTALLATION_IDS", [DEMO_INSTALLATION])
    headers = _make_user(db_session, installation_id=MY_INSTALLATION, email="me@example.com")

    assert _repos(client, headers) == ["me/my-repo"]
    assert client.get("/auth/me", headers=headers).json()["viewing_demo_data"] is False


def test_user_without_installation_sees_nothing_when_demo_not_configured(client, db_session):
    headers = _make_user(db_session, email="new@example.com")

    assert _repos(client, headers) == []
    assert client.get("/summary", headers=headers).json()["total_events"] == 0
    assert client.get("/auth/me", headers=headers).json()["viewing_demo_data"] is False


def test_user_without_installation_sees_only_demo_tenant(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_INSTALLATION_IDS", [DEMO_INSTALLATION])
    headers = _make_user(db_session, email="new@example.com")

    assert _repos(client, headers) == ["demo-org/demo-repo"]
    assert client.get("/summary", headers=headers).json()["total_events"] == 1
    assert client.get("/auth/me", headers=headers).json()["viewing_demo_data"] is True


# ── Demo login ────────────────────────────────────────────────────────────────

def test_demo_login_unavailable_when_not_configured(client):
    assert client.post("/auth/demo").status_code == 404


def test_demo_login_reuses_one_shared_account(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_INSTALLATION_IDS", [DEMO_INSTALLATION])

    first = client.post("/auth/demo").json()["access_token"]
    second = client.post("/auth/demo").json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {first}"}).json()
    assert me["is_demo"] is True
    assert me["viewing_demo_data"] is True
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {second}"}).json()["id"] == me["id"]
    assert db_session.query(UserAccount).filter(UserAccount.is_demo.is_(True)).count() == 1

    assert _repos(client, {"Authorization": f"Bearer {first}"}) == ["demo-org/demo-repo"]


def test_demo_account_is_read_only(client, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_INSTALLATION_IDS", [DEMO_INSTALLATION])
    token = client.post("/auth/demo").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/settings/alert-rules", headers=headers).status_code == 200
    assert client.post(
        "/settings/alert-rules",
        headers=headers,
        json={"rule_type": "workflow_failure", "webhook_url": "https://hooks.slack.com/services/T/B/X"},
    ).status_code == 403


# ── Stream tickets ────────────────────────────────────────────────────────────

def test_stream_ticket_requires_login(client):
    assert client.post("/events/stream-ticket").status_code in (401, 403)


def test_stream_ticket_is_short_lived_and_for_this_user(client, db_session):
    headers = _make_user(db_session, email="me@example.com")
    ticket = client.post("/events/stream-ticket", headers=headers).json()["ticket"]

    payload = pyjwt.decode(ticket, settings.JWT_SECRET, algorithms=["HS256"])
    me = client.get("/auth/me", headers=headers).json()
    assert payload["sub"] == str(me["id"])
    assert payload["typ"] == "stream"
    assert payload["exp"] - time.time() <= 30


def test_stream_ticket_cannot_be_used_as_login_token(client, db_session):
    headers = _make_user(db_session, email="me@example.com")
    ticket = client.post("/events/stream-ticket", headers=headers).json()["ticket"]

    assert client.get("/auth/me", headers={"Authorization": f"Bearer {ticket}"}).status_code == 401


def test_stream_rejects_login_token_in_url(client, db_session):
    headers = _make_user(db_session, email="me@example.com")
    access_token = headers["Authorization"].removeprefix("Bearer ")

    assert client.get(f"/events/stream?ticket={access_token}").status_code == 401


def test_stream_rejects_expired_ticket(client, db_session):
    headers = _make_user(db_session, email="me@example.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    expired = pyjwt.encode(
        {"sub": str(user_id), "typ": "stream", "exp": int(time.time()) - 1},
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    assert client.get(f"/events/stream?ticket={expired}").status_code == 401


# ── Analytics cache ───────────────────────────────────────────────────────────

def _add_push(db_session, installation_id, repo):
    db_session.add(GitHubEvent(event_type="push", repo_name=repo, actor="x", installation_id=installation_id))
    db_session.commit()


def test_repeat_requests_are_served_from_cache_until_invalidated(client, db_session):
    headers = _make_user(db_session, installation_id=MY_INSTALLATION, email="me@example.com")
    assert _repos(client, headers) == ["me/my-repo"]

    _add_push(db_session, MY_INSTALLATION, "me/second-repo")
    assert _repos(client, headers) == ["me/my-repo"]  # cached

    analytics_cache.invalidate_installation(MY_INSTALLATION)  # what a new webhook does
    assert _repos(client, headers) == ["me/my-repo", "me/second-repo"]


def test_cache_is_not_shared_between_tenants(client, db_session):
    mine = _make_user(db_session, installation_id=MY_INSTALLATION, email="me@example.com")
    theirs = _make_user(db_session, installation_id=OTHER_TENANT_INSTALLATION, email="them@example.com")

    assert _repos(client, mine) == ["me/my-repo"]
    assert _repos(client, theirs) == ["someone-else/private-repo"]


def test_cache_key_includes_query_params(client, db_session):
    headers = _make_user(db_session, installation_id=MY_INSTALLATION, email="me@example.com")
    _add_push(db_session, MY_INSTALLATION, "me/second-repo")

    all_repos = client.get("/summary/top-actors", headers=headers).json()
    one_repo = client.get("/summary/top-actors?repo_name=me/second-repo", headers=headers).json()

    assert all_repos == [{"actor": "x", "count": 2}]
    assert one_repo == [{"actor": "x", "count": 1}]
