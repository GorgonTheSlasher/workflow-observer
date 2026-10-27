from app.event_handlers.push import handle_push_event
from app.event_handlers.pull_request import handle_pull_request_event
from app.event_handlers.issues import handle_issues_event


def test_handle_push_event():
    payload = {
        "ref": "refs/heads/main",
        "after": "abc123",
        "repository": {
            "full_name": "GorgonTheSlasher/test-repo",
            "html_url": "https://github.com/GorgonTheSlasher/test-repo",
        },
        "pusher": {
            "name": "GorgonTheSlasher",
        },
        "sender": {
            "login": "GorgonTheSlasher",
        },
        "commits": [{}, {}],
    }

    result = handle_push_event(payload)

    assert result["event_type"] == "push"
    assert result["repo_name"] == "GorgonTheSlasher/test-repo"
    assert result["branch"] == "main"
    assert result["actor"] == "GorgonTheSlasher"
    assert result["commit_sha"] == "abc123"

def test_handle_pull_request_event_reads_head_branch_and_sha():
    payload = {
        "action": "opened",
        "pull_request": {
            "number": 7,
            "html_url": "https://github.com/acme/app/pull/7",
            "head": {"ref": "feature/login", "sha": "def456"},
        },
        "repository": {"full_name": "acme/app", "html_url": "https://github.com/acme/app"},
        "sender": {"login": "octocat"},
    }

    result = handle_pull_request_event(payload)

    assert result["branch"] == "feature/login"
    assert result["commit_sha"] == "def456"
    assert result["html_url"] == "https://github.com/acme/app/pull/7"


def test_handle_issues_event_links_to_issue():
    payload = {
        "action": "opened",
        "issue": {"number": 3, "html_url": "https://github.com/acme/app/issues/3"},
        "repository": {"full_name": "acme/app", "html_url": "https://github.com/acme/app"},
        "sender": {"login": "octocat"},
    }

    result = handle_issues_event(payload)

    assert result["actor"] == "octocat"
    assert result["html_url"] == "https://github.com/acme/app/issues/3"
