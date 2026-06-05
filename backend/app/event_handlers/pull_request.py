def handle_pull_request_event(payload: dict):
    action = payload.get("action")
    pull_request = payload.get("pull_request", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "pull_request",
        "action": action,
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("head_branch"),
        "status": pull_request.get("status"),
        "conclusion": pull_request.get("conclusion"),
        "commit_sha": pull_request.get("head_sha"),
        "html_url": repo.get("html_url"),

        "details_json": payload
    }