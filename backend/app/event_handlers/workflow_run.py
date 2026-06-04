def handle_workflow_run_event(payload: dict):
    action = payload.get("action")
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})
    workflow_run = payload.get("workflow_run", {})

    return {
        "event_type": "workflow_run",
        "action": action,
        "repo_name": repo.get("full_name"),
        "actor": sender.get("login"),
        "branch": repo.get("head_branch"),
        "status": workflow_run.get("status"),
        "conclusion": workflow_run.get("conclusion"),
        "commit_sha": workflow_run.get("head_sha"),
        "html_url": repo.get("html_url"),

        "details_json": payload,
    }