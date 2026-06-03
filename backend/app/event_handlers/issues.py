def handle_issues_event(payload: dict):
    issues = payload.get("issues", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        # base columns (needs confirmation)
        #"event_type": event_object.get("event_type"),
        "action": payload.get("action"),
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("branch"),
        "status": issues.get("status"),
        "conclusion": issues.get("conclusion"),
        "commit_sha": issues.get("commit_sha"),
        "html_url": repo.get("html_url"),
    }