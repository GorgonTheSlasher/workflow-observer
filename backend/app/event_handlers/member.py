def handle_member_event(payload: dict):
    action = payload.get("action")
    member = payload.get("member", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "issues",
        "action": action,
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("head_branch"),
        "status": member.get("status"),
        "conclusion": member.get("conclusion"),
        "commit_sha": member.get("head_sha"),
        "html_url": repo.get("html_url"),

        "details_json": payload,
    }