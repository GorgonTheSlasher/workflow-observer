def handle_push_event(payload: dict):
    repo = payload.get("repository", {})
    pusher = payload.get("pusher", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "push",
        "repo_name": repo.get("full_name"),
        "branch": payload.get("ref", "").replace("refs/heads/", ""),
        "actor": sender.get("login") or pusher.get("name"),
        "commit_sha": payload.get("after"),
        "commit_count": len(payload.get("commits", [])),
    }