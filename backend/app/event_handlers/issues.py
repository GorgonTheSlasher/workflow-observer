def handle_issues_event(payload: dict):
    action = payload.get("action")
    issues = payload.get("issues", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "issues",
        "action": action,
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("head_branch"),
        "status": issues.get("status"),
        "conclusion": issues.get("conclusion"),
        "commit_sha": issues.get("head_sha"),
        "html_url": repo.get("html_url"),

        "details_json": payload,
    }