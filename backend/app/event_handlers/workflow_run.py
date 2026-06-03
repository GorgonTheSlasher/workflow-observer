def handle_workflow_run_event(payload: dict):
    workflow = payload.get("workflow") or {}
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})


    return {
        # base columns (needs confirmation)
        #"event_type": event_object.get("event_type"),
       # "action": payload.get("action"),
       # "repo_name": repo.get("full_name"),
       # "actor": sender.get("login"),
       # "branch": repo.get("branch"),
       # "status": workflow.get("status"),
       # "conclusion": workflow.get("conclusion"),
       # "commit_sha": workflow.get("commit_sha"),
       # "html_url": repo.get("html_url"),
    
        "event_type": "workflow_run",
        "action": payload.get("action"),

        "repo_name": repo.get("full_name"),
        "repo_id": repo.get("id"),

        "workflow_id": workflow.get("id"),
        "workflow_name": workflow.get("name") or workflow.get("name"),

        "run_id": workflow.get("id"),
        "run_number": workflow.get("run_number"),
        "run_attempt": workflow.get("run_attempt"),

        "status": workflow.get("status"),
        "conclusion": workflow.get("conclusion"),

        "trigger_event": workflow.get("event"),
        "branch": workflow.get("head_branch"),
        "commit_sha": workflow.get("head_sha"),

        "actor": sender.get("login"),

        "html_url": workflow.get("html_url"),

        "created_at": workflow.get("created_at"),
        "updated_at": workflow.get("updated_at"),
        "run_started_at": workflow.get("run_started_at"),
    }