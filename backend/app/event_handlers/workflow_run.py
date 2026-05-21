def handle_workflow_run_event(payload: dict):
    workflow_run = payload.get("workflow_run", {})
    workflow = payload.get("workflow") or {}
    repository = payload.get("repository", {})
    sender = payload.get("sender", {})
    actor = workflow_run.get("actor") or {}

    return {
        "event_type": "workflow_run",
        "action": payload.get("action"),

        "repo_name": repository.get("full_name"),
        "repo_id": repository.get("id"),

        "workflow_id": workflow.get("id"),
        "workflow_name": workflow_run.get("name") or workflow.get("name"),

        "run_id": workflow_run.get("id"),
        "run_number": workflow_run.get("run_number"),
        "run_attempt": workflow_run.get("run_attempt"),

        "status": workflow_run.get("status"),
        "conclusion": workflow_run.get("conclusion"),

        "trigger_event": workflow_run.get("event"),
        "branch": workflow_run.get("head_branch"),
        "commit_sha": workflow_run.get("head_sha"),

        "actor": actor.get("login") or sender.get("login"),

        "html_url": workflow_run.get("html_url"),

        "created_at": workflow_run.get("created_at"),
        "updated_at": workflow_run.get("updated_at"),
        "run_started_at": workflow_run.get("run_started_at"),
    }