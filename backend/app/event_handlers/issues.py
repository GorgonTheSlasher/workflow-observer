def handle_issues_event(payload: dict) -> dict:
    issue = payload.get("issue", {})
    repository = payload.get("repository", {})
    sender = payload.get("sender", {})
    labels = issue.get("labels", [])
    assignees = issue.get("assignees", [])

    return {
        "event_type": "issues",
        "action": payload.get("action"),

        "repo_name": repository.get("full_name"),
        "repo_id": repository.get("id"),

        "issue_number": issue.get("number"),
        "issue_title": issue.get("title"),
        "issue_state": issue.get("state"),
        "issue_author": issue.get("user", {}).get("login"),

        "labels": [label.get("name") for label in labels],
        "assignees": [user.get("login") for user in assignees],

        "actor": sender.get("login"),
        "html_url": issue.get("html_url"),

        "created_at": issue.get("created_at"),
        "updated_at": issue.get("updated_at"),
        "closed_at": issue.get("closed_at"),
    }