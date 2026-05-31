import os
import requests
from dotenv import load_dotenv

load_dotenv()

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")


def send_slack_alert(message: str) -> None:
    if not SLACK_WEBHOOK_URL:
        print("SLACK_WEBHOOK_URL not configured. Skipping alert.")
        return

    response = requests.post(
        SLACK_WEBHOOK_URL,
        json={"text": message},
        timeout=10,
    )

    if response.status_code >= 400:
        print(f"Slack alert failed: {response.status_code} {response.text}")

def should_alert_on_event(event_type: str, event_data: dict) -> bool:
    return (
        event_type == "workflow_run"
        and event_data.get("status") == "completed"
        and event_data.get("conclusion") == "failure"
    )

def format_workflow_failure_alert(event_data: dict) -> str:
    repo = event_data.get("repo_name", "Unknown repo")
    workflow = event_data.get("workflow_name", "Unknown workflow")
    branch = event_data.get("branch", "Unknown branch")
    actor = event_data.get("actor", "Unknown actor")
    commit_sha = event_data.get("commit_sha", "")

    short_sha = commit_sha[:7] if commit_sha else "Unknown"

    url = event_data.get("html_url", "")

    return (
        "**Workflow Failed**\n"
        f"**Repo:** {repo}\n"
        f"**Workflow:** {workflow}\n"
        f"**Branch:** {branch}\n"
        f"**Actor:** {actor}\n"
        f"**Commit:** `{short_sha}`\n"
        f"**Run:** {url}"
    )