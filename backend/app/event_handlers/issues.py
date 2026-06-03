def handle_issues_event(payload: dict):
    event_object = payload.get("event_object", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        # base columns (needs confirmation)
        "event_type": event_object.get("event_type"),
        "action": payload.get("action"),
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("branch"),
        "status": event_object.get("status"),
        "conclusion": event_object.get("conclusion"),
        "commit_sha": event_object.get("commit_sha"),
        "html_url": repo.get("html_url"),
    }