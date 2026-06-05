def handle_push_event(payload: dict):
    ref = payload.get("ref", "")
    # pusher = payload.get("pusher", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "push",
        "action": payload.get("action"),
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": ref.replace("refs/heads/", "") if ref else None,
        "status": payload.get("status"),
        "conclusion": payload.get("conclusion"),
        "commit_sha": payload.get("after"),
        "html_url": repo.get("html_url"),

        "details_json": payload
    }