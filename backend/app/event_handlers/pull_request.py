def handle_pull_request_event(payload: dict):
    action = payload.get("action")
    pull_request = payload.get("pull_request", {})
    head = pull_request.get("head") or {}
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "pull_request",
        "action": action,
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": head.get("ref"),
        "status": pull_request.get("status"),
        "conclusion": pull_request.get("conclusion"),
        "commit_sha": head.get("sha"),
        "html_url": pull_request.get("html_url") or repo.get("html_url"),

        "details_json": payload
    }
