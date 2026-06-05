from app.event_handlers.push import handle_push_event


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