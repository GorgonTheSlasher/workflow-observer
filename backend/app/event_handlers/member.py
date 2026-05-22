def handle_member_event(payload: dict):
    member = payload.get("member") or {}
    repository = payload.get("repository", {})
    sender = payload.get("sender", {})

    return {
        "event_type": "member",
        "action": payload.get("action"),

        "repo_name": repository.get("full_name"),
        "repo_id": repository.get("id"),

        "member_login": member.get("login"),
        "member_id": member.get("id"),
        "member_url": member.get("html_url"),

        "actor": sender.get("login"),
        "actor_id": sender.get("id"),

        "html_url": repository.get("html_url"),
    }