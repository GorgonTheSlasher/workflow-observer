def handle_push_event(payload: dict):
    commits = payload.get("commits")
    # pusher = payload.get("pusher", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "issues",
        "action": payload.get("action"),
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("head_branch"),
        "status": commits.get("status"),
        "conclusion": commits.get("conclusion"),
        "commit_sha": commits.get("head_sha"),
        "html_url": repo.get("html_url"),

        "details_json": payload
    }