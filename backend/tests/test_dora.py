from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import GitHubEvent
from app.services.analytic_services import _is_deploy_workflow, get_dora_metrics

START = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _run(db, repo, name, branch="main", conclusion="success", sha="abc", at=START):
    db.add(GitHubEvent(
        event_type="workflow_run",
        repo_name=repo,
        branch=branch,
        status="completed",
        conclusion=conclusion,
        commit_sha=sha,
        created_at=at,
        details_json={"workflow_run": {"name": name, "updated_at": at.strftime("%Y-%m-%dT%H:%M:%SZ")}},
    ))
    db.commit()


@pytest.mark.parametrize("name", ["Deploy", "deploy-prod", "Release", "Publish to npm", "CI/CD"])
def test_deploy_like_workflow_names(name):
    assert _is_deploy_workflow(name) is True


@pytest.mark.parametrize("name", ["CI", "Lint", "Tests", "CodeQL", "Decode fixtures"])
def test_non_deploy_workflow_names(name):
    assert _is_deploy_workflow(name) is False


def test_only_deploy_workflows_count_when_repo_has_one(db):
    for name in ["CI", "Lint", "Deploy"]:
        _run(db, "acme/app", name)
    _run(db, "acme/app", "Deploy", branch="feature/x")  # not main, never a deploy

    df = get_dora_metrics(db=db, start_date=START, end_date=START + timedelta(days=1))["deploy_frequency"]

    assert df["value"] == 1
    assert df["workflows"] == ["Deploy"]
    assert df["fallback"] is False


def test_falls_back_to_all_main_runs_without_deploy_workflow(db):
    for name in ["CI", "Lint"]:
        _run(db, "acme/lib", name)

    df = get_dora_metrics(db=db, start_date=START, end_date=START + timedelta(days=1))["deploy_frequency"]

    assert df["value"] == 2
    assert df["fallback"] is True


def test_fallback_is_decided_per_repo(db):
    for name in ["CI", "Deploy"]:
        _run(db, "acme/app", name)
    _run(db, "acme/lib", "CI")

    df = get_dora_metrics(db=db, start_date=START, end_date=START + timedelta(days=1))["deploy_frequency"]

    # acme/app counts only Deploy, acme/lib has no deploy workflow so its CI run counts
    assert df["value"] == 2
    assert df["workflows"] == ["CI", "Deploy"]
    assert df["fallback"] is True


def _push(db, repo, branch, sha, at):
    db.add(GitHubEvent(event_type="push", repo_name=repo, branch=branch, commit_sha=sha, created_at=at))
    db.commit()


def _merged_pr(db, repo, branch, merge_sha, opened_at, merged_at):
    db.add(GitHubEvent(
        event_type="pull_request",
        action="closed",
        repo_name=repo,
        branch=branch,
        created_at=merged_at,
        details_json={"pull_request": {
            "head": {"ref": branch},
            "merged": True,
            "merge_commit_sha": merge_sha,
            "created_at": opened_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "merged_at": merged_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }},
    ))
    db.commit()


def test_change_failure_rate_counts_only_deployments(db):
    _run(db, "acme/app", "Deploy", conclusion="success")
    _run(db, "acme/app", "Deploy", conclusion="failure")
    for _ in range(8):
        _run(db, "acme/app", "CI", branch="feature/x", conclusion="failure")  # red CI isn't a failed change

    assert get_dora_metrics(db=db)["change_failure_rate"]["value"] == 50.0


def test_mttr_runs_from_first_failure_in_a_streak(db):
    _run(db, "acme/app", "Deploy", conclusion="failure", at=START)
    _run(db, "acme/app", "Deploy", conclusion="failure", at=START + timedelta(hours=1))
    _run(db, "acme/app", "Deploy", conclusion="success", at=START + timedelta(hours=3))

    assert get_dora_metrics(db=db)["mttr"]["value"] == 3.0


def test_mttr_does_not_cross_repos(db):
    _run(db, "acme/app", "Deploy", conclusion="failure", at=START)
    _run(db, "acme/other", "Deploy", conclusion="success", at=START + timedelta(hours=1))
    _run(db, "acme/app", "Deploy", conclusion="success", at=START + timedelta(hours=5))

    assert get_dora_metrics(db=db)["mttr"]["value"] == 5.0


def test_lead_time_starts_at_first_commit_of_merged_pr(db):
    _push(db, "acme/app", "feature/x", "c1", START)
    _push(db, "acme/app", "feature/x", "c2", START + timedelta(hours=5))
    _merged_pr(db, "acme/app", "feature/x", "merge1", START + timedelta(hours=1), START + timedelta(hours=8))
    _push(db, "acme/app", "main", "merge1", START + timedelta(hours=8))
    _run(db, "acme/app", "Deploy", sha="merge1", at=START + timedelta(hours=10))

    # First commit at START, deployed at +10h (not +2h from the merge push)
    assert get_dora_metrics(db=db)["lead_time"]["value"] == 10.0


def test_lead_time_ignores_pushes_from_an_earlier_pr_on_a_reused_branch(db):
    _push(db, "acme/app", "fix/bug", "old", START)
    _merged_pr(db, "acme/app", "fix/bug", "merge-old", START, START + timedelta(hours=1))

    _push(db, "acme/app", "fix/bug", "new", START + timedelta(days=2))
    _merged_pr(db, "acme/app", "fix/bug", "merge-new", START + timedelta(days=2), START + timedelta(days=2, hours=3))
    _run(db, "acme/app", "Deploy", sha="merge-new", at=START + timedelta(days=2, hours=4))

    assert get_dora_metrics(db=db)["lead_time"]["value"] == 4.0


def test_lead_time_measured_to_deploy_not_ci(db):
    db.add(GitHubEvent(event_type="push", repo_name="acme/app", branch="main", commit_sha="abc", created_at=START))
    _run(db, "acme/app", "CI", at=START + timedelta(minutes=5))
    _run(db, "acme/app", "Deploy", at=START + timedelta(minutes=60))

    lt = get_dora_metrics(db=db)["lead_time"]

    assert lt["value"] == 1.0
