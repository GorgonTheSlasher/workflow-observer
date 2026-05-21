from .issues import handle_issues_event
from .member import handle_member_event
from .pull_request import handle_pull_request_event
from .push import handle_push_event
from .workflow_run import handle_workflow_run_event

EVENT_HANDLERS = {
    "issues": handle_issues_event,
    "member": handle_member_event,
    "pull_request": handle_pull_request_event,
    "push": handle_push_event,
    "workflow_run": handle_workflow_run_event
}