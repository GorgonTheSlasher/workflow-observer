def handle_pull_request_event(payload: dict) -> dict:
    pr = payload.get("pull_request", {})
    repository = payload.get("repository", {})
    sender = payload.get("sender", {})
    head = pr.get("head", {})
    base = pr.get("base", {})

    return {
        "event_type": "pull_request",
        "action": payload.get("action"),

        "repo_name": repository.get("full_name"),
        "repo_id": repository.get("id"),

        "pr_number": pr.get("number") or payload.get("number"),
        "pr_title": pr.get("title"),
        "pr_state": pr.get("state"),
        "is_draft": pr.get("draft"),
        "merged": pr.get("merged"),

        "author": pr.get("user", {}).get("login"),
        "actor": sender.get("login"),

        "source_branch": head.get("ref"),
        "target_branch": base.get("ref"),

        "commits": pr.get("commits"),
        "additions": pr.get("additions"),
        "deletions": pr.get("deletions"),
        "changed_files": pr.get("changed_files"),

        "html_url": pr.get("html_url"),

        "created_at": pr.get("created_at"),
        "updated_at": pr.get("updated_at"),
        "closed_at": pr.get("closed_at"),
        "merged_at": pr.get("merged_at"),
    }