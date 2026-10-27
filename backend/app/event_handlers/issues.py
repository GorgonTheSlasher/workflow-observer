def handle_issues_event(payload: dict):
    action = payload.get("action")
    issue = payload.get("issue", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "issues",
        "action": action,
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": None,
        "status": issue.get("status"),
        "conclusion": issue.get("conclusion"),
        "commit_sha": None,
        "html_url": issue.get("html_url") or repo.get("html_url"),

        "details_json": payload,
    }
