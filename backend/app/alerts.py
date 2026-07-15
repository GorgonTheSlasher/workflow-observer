from datetime import datetime, UTC

import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.models import GitHubEvent

SLACK_WEBHOOK_URL = settings.SLACK_WEBHOOK_URL

_MAIN_BRANCHES = {"main", "master"}


# ── Transport ─────────────────────────────────────────────────────────────────

def send_slack_alert(payload: dict) -> None:
    if not SLACK_WEBHOOK_URL:
        print("SLACK_WEBHOOK_URL not configured. Skipping alert.")
        return

    try:
        response = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
    except requests.RequestException:
        print("Unable to reach Slack server")
        return

    if response.status_code >= 400:
        print(f"Slack alert failed: {response.status_code} {response.text}")


# ── Shared helpers ────────────────────────────────────────────────────────────

def _slack_timestamp() -> str:
    ts = int(datetime.now(UTC).timestamp())
    fallback = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    return f"<!date^{ts}^{{date_short_pretty}} at {{time}}|{fallback}>"


def _short_sha(sha: str | None) -> str:
    return sha[:7] if sha else "unknown"


def _repo_url(repo_name: str | None) -> str:
    return f"https://github.com/{repo_name}" if repo_name else ""


def _workflow_name(event_data: dict) -> str:
    details = event_data.get("details_json") or {}
    return (details.get("workflow_run") or {}).get("name") or "Unknown workflow"


# ── Condition checkers ────────────────────────────────────────────────────────

def should_alert_on_event(event_type: str, event_data: dict) -> bool:
    """Legacy single-check kept for backward compatibility with tests."""
    return (
        event_type == "workflow_run"
        and event_data.get("status") == "completed"
        and event_data.get("conclusion") == "failure"
    )


def _is_workflow_failure(event_type: str, event_data: dict) -> bool:
    return (
        event_type == "workflow_run"
        and event_data.get("status") == "completed"
        and event_data.get("conclusion") == "failure"
    )


def _is_force_push_to_main(event_type: str, event_data: dict) -> bool:
    if event_type != "push":
        return False
    details = event_data.get("details_json") or {}
    branch = event_data.get("branch") or ""
    return bool(details.get("forced")) and branch in _MAIN_BRANCHES


def _is_new_member(event_type: str, event_data: dict) -> bool:
    return event_type == "member" and event_data.get("action") == "added"


def _get_recovery_info(
    event_type: str,
    event_data: dict,
    saved_event: GitHubEvent,
    db: Session,
) -> tuple[bool, float | None]:
    """
    Returns (is_recovery, downtime_hours).
    A recovery is when the current successful run follows a failure on the
    same repo + branch + workflow name.
    """
    if not (event_type == "workflow_run" and event_data.get("conclusion") == "success"):
        return False, None

    repo_name = event_data.get("repo_name")
    branch = event_data.get("branch")
    wf_name = _workflow_name(event_data)

    # Fetch the most recent previous completed events for the same repo+branch
    # (exclude the event we just saved so we don't compare against ourselves)
    candidates = (
        db.query(GitHubEvent)
        .filter(
            GitHubEvent.id != saved_event.id,
            GitHubEvent.repo_name == repo_name,
            GitHubEvent.event_type == "workflow_run",
            GitHubEvent.branch == branch,
            GitHubEvent.conclusion.in_(["success", "failure"]),
        )
        .order_by(GitHubEvent.created_at.desc())
        .limit(10)
        .all()
    )

    # Find the most recent event that matches this specific workflow name
    prev = None
    for c in candidates:
        c_name = ((c.details_json or {}).get("workflow_run") or {}).get("name")
        if c_name == wf_name:
            prev = c
            break

    if prev is None or prev.conclusion != "failure":
        return False, None

    downtime_hours: float | None = None
    if prev.created_at and saved_event.created_at:
        delta = (saved_event.created_at - prev.created_at).total_seconds() / 3600
        downtime_hours = round(delta, 1) if delta >= 0 else None

    return True, downtime_hours


# ── Block Kit formatters ──────────────────────────────────────────────────────

def format_workflow_failure_alert(event_data: dict) -> dict:
    repo_name = event_data.get("repo_name") or "Unknown repo"
    actor     = event_data.get("actor") or "Unknown"
    branch    = event_data.get("branch") or "Unknown branch"
    html_url  = event_data.get("html_url") or ""
    short_sha = _short_sha(event_data.get("commit_sha"))
    wf_name   = _workflow_name(event_data)
    repo_link = _repo_url(repo_name)

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":red_circle: *Workflow Failed* — <{repo_link}|{repo_name}>",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Workflow*\n{wf_name}"},
                {"type": "mrkdwn", "text": f"*Branch*\n`{branch}`"},
                {"type": "mrkdwn", "text": f"*Triggered by*\n{actor}"},
                {"type": "mrkdwn", "text": f"*Commit*\n`{short_sha}`"},
            ],
        },
    ]

    if html_url:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View Run →", "emoji": False},
                    "url": html_url,
                    "style": "danger",
                }
            ],
        })

    blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": _slack_timestamp()}],
    })

    return {"attachments": [{"color": "#e53935", "blocks": blocks}]}


def format_workflow_recovery_alert(event_data: dict, downtime_hours: float | None) -> dict:
    repo_name = event_data.get("repo_name") or "Unknown repo"
    actor     = event_data.get("actor") or "Unknown"
    branch    = event_data.get("branch") or "Unknown branch"
    html_url  = event_data.get("html_url") or ""
    wf_name   = _workflow_name(event_data)
    repo_link = _repo_url(repo_name)

    def _fmt_downtime(h: float) -> str:
        if h < 1:
            return f"{round(h * 60)}m"
        if h < 24:
            return f"{h:.1f}h"
        return f"{h / 24:.1f}d"

    fields = [
        {"type": "mrkdwn", "text": f"*Workflow*\n{wf_name}"},
        {"type": "mrkdwn", "text": f"*Branch*\n`{branch}`"},
        {"type": "mrkdwn", "text": f"*Fixed by*\n{actor}"},
    ]
    if downtime_hours is not None:
        fields.append({"type": "mrkdwn", "text": f"*Downtime*\n{_fmt_downtime(downtime_hours)}"})

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":large_green_circle: *Workflow Recovered* — <{repo_link}|{repo_name}>",
            },
        },
        {"type": "section", "fields": fields},
    ]

    if html_url:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View Run →", "emoji": False},
                    "url": html_url,
                    "style": "primary",
                }
            ],
        })

    blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": _slack_timestamp()}],
    })

    return {"attachments": [{"color": "#00c851", "blocks": blocks}]}


def format_force_push_alert(event_data: dict) -> dict:
    repo_name = event_data.get("repo_name") or "Unknown repo"
    actor     = event_data.get("actor") or "Unknown"
    branch    = event_data.get("branch") or "Unknown branch"
    sha       = event_data.get("commit_sha") or ""
    short_sha = _short_sha(sha)
    repo_link = _repo_url(repo_name)
    commit_url = (
        f"https://github.com/{repo_name}/commit/{sha}" if sha else repo_link
    )

    return {
        "attachments": [
            {
                "color": "#FFB800",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f":warning: *Force Push to `{branch}`* — <{repo_link}|{repo_name}>",
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Pushed by*\n{actor}"},
                            {"type": "mrkdwn", "text": f"*Commit*\n`{short_sha}`"},
                        ],
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {"type": "plain_text", "text": "View Commit →", "emoji": False},
                                "url": commit_url,
                            }
                        ],
                    },
                    {
                        "type": "context",
                        "elements": [{"type": "mrkdwn", "text": _slack_timestamp()}],
                    },
                ],
            }
        ]
    }


def format_new_member_alert(event_data: dict) -> dict:
    repo_name = event_data.get("repo_name") or "Unknown repo"
    added_by  = event_data.get("actor") or "Unknown"
    repo_link = _repo_url(repo_name)

    details    = event_data.get("details_json") or {}
    member     = details.get("member") or {}
    new_member = member.get("login") or "Unknown"
    member_url = member.get("html_url") or f"https://github.com/{new_member}"

    return {
        "attachments": [
            {
                "color": "#5b9bd5",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f":bust_in_silhouette: *New Member Added* — <{repo_link}|{repo_name}>",
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*New Member*\n<{member_url}|{new_member}>"},
                            {"type": "mrkdwn", "text": f"*Added by*\n{added_by}"},
                        ],
                    },
                    {
                        "type": "context",
                        "elements": [{"type": "mrkdwn", "text": _slack_timestamp()}],
                    },
                ],
            }
        ]
    }


def format_test_alert() -> dict:
    return {
        "attachments": [
            {
                "color": "#00c851",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": ":white_check_mark: *Workflow Observer is connected!*\nYour Slack alerts are configured correctly. You'll receive notifications here when monitored events are detected.",
                        },
                    },
                    {
                        "type": "context",
                        "elements": [{"type": "mrkdwn", "text": _slack_timestamp()}],
                    },
                ],
            }
        ]
    }


# ── Main entry point ──────────────────────────────────────────────────────────

def get_alerts_for_event(
    event_type: str,
    event_data: dict,
    saved_event: GitHubEvent,
    db: Session,
) -> list[dict]:
    """Returns all Block Kit payloads that should be sent for this event."""
    alerts = []

    if _is_workflow_failure(event_type, event_data):
        alerts.append(format_workflow_failure_alert(event_data))

    is_recovery, downtime_hours = _get_recovery_info(event_type, event_data, saved_event, db)
    if is_recovery:
        alerts.append(format_workflow_recovery_alert(event_data, downtime_hours))

    if _is_force_push_to_main(event_type, event_data):
        alerts.append(format_force_push_alert(event_data))

    if _is_new_member(event_type, event_data):
        alerts.append(format_new_member_alert(event_data))

    return alerts
