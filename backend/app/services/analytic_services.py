from collections import defaultdict
from datetime import datetime, UTC, timedelta

from fastapi import Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GitHubEvent


def get_filtered_events(
    event_type: str | None = None,
    repo_name: str | None = None,
    actor: str | None = None,
    conclusion: str | None = None,
    search: str | None = None,
    since_days: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> dict:

    query = db.query(GitHubEvent)

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if conclusion:
        query = query.filter(GitHubEvent.conclusion == conclusion)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                GitHubEvent.repo_name.ilike(pattern),
                GitHubEvent.actor.ilike(pattern),
                GitHubEvent.branch.ilike(pattern),
                GitHubEvent.commit_sha.ilike(pattern),
            )
        )

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    total = query.count()

    events = (
        query
        .order_by(GitHubEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {"total": total, "events": events}


_TIMELINE_EVENT_TYPES = ["push", "pull_request", "workflow_run", "issues", "member"]

def get_top_actors(
    repo_name: str | None = None,
    limit: int = 5,
    since_days: int | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(
        GitHubEvent.actor,
        func.count(GitHubEvent.id).label("count"),
    ).filter(GitHubEvent.actor.isnot(None))

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(GitHubEvent.actor)
        .order_by(func.count(GitHubEvent.id).desc())
        .limit(limit)
        .all()
    )

    return [{"actor": actor, "count": count} for actor, count in rows]

def get_event_type_breakdown(
    repo_name: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(
        GitHubEvent.event_type,
        func.count(GitHubEvent.id).label("count"),
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    if actor:
        query = query.filter(GitHubEvent.actor == actor)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(GitHubEvent.event_type)
        .order_by(func.count(GitHubEvent.id).desc())
        .all()
    )

    return [{"event_type": event_type, "count": count} for event_type, count in rows]

def get_workflow_failures_by_name(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.details_json).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion == "failure",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    counts: dict[str, int] = defaultdict(int)
    for (details_json,) in query.all():
        workflow_run = (details_json or {}).get("workflow_run", {})
        name = workflow_run.get("name") or "Unknown"
        counts[name] += 1

    return [
        {"workflow_name": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

def get_workflow_failures_by_branch(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(
        GitHubEvent.branch,
        func.count(GitHubEvent.id).label("count"),
    ).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion == "failure",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = (
        query
        .group_by(GitHubEvent.branch)
        .order_by(func.count(GitHubEvent.id).desc())
        .all()
    )

    return [{"branch": branch or "Unknown", "count": count} for branch, count in rows]

def get_workflow_run_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.created_at, GitHubEvent.conclusion).filter(
        GitHubEvent.event_type == "workflow_run",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    pivot: dict[str, dict[str, int]] = defaultdict(lambda: {"success": 0, "failure": 0, "other": 0})

    for created_at, conclusion in query.all():
        if created_at is None:
            continue
        date_str = created_at.strftime('%Y-%m-%d')
        if conclusion == "success":
            pivot[date_str]["success"] += 1
        elif conclusion == "failure":
            pivot[date_str]["failure"] += 1
        else:
            pivot[date_str]["other"] += 1

    return [{"date": date, **counts} for date, counts in sorted(pivot.items())]

def get_pr_cycle_times(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.details_json, GitHubEvent.created_at).filter(
        GitHubEvent.event_type == "pull_request",
        GitHubEvent.action == "closed",
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    day_durations: dict[str, list[float]] = defaultdict(list)

    for (details_json, created_at) in query.all():
        pr = (details_json or {}).get("pull_request", {})
        opened_at = pr.get("created_at")
        closed_at = pr.get("closed_at") or pr.get("merged_at")

        if not opened_at or not closed_at:
            continue

        try:
            start = datetime.fromisoformat(opened_at.replace("Z", "+00:00"))
            end = datetime.fromisoformat(closed_at.replace("Z", "+00:00"))
            hours = (end - start).total_seconds() / 3600
            if hours > 0:
                date_str = created_at.strftime("%Y-%m-%d") if created_at else end.strftime("%Y-%m-%d")
                day_durations[date_str].append(hours)
        except (ValueError, AttributeError):
            continue

    return [
        {
            "date": date,
            "avg_hours": round(sum(times) / len(times), 1),
            "count": len(times),
        }
        for date, times in sorted(day_durations.items())
    ]


def get_workflow_execution_times(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.details_json).filter(
        GitHubEvent.event_type == "workflow_run",
        GitHubEvent.conclusion.in_(["success", "failure"]),
    )

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    durations: dict[str, list[float]] = defaultdict(list)

    for (details_json,) in query.all():
        workflow_run = (details_json or {}).get("workflow_run", {})
        name = workflow_run.get("name") or "Unknown"
        started_at = workflow_run.get("run_started_at")
        updated_at = workflow_run.get("updated_at")

        if not started_at or not updated_at:
            continue

        try:
            start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            duration_seconds = (end - start).total_seconds()
            if duration_seconds > 0:
                durations[name].append(duration_seconds)
        except (ValueError, AttributeError):
            continue

    return [
        {
            "workflow_name": name,
            "avg_seconds": round(sum(times) / len(times), 1),
            "run_count": len(times),
        }
        for name, times in sorted(
            durations.items(),
            key=lambda kv: sum(kv[1]) / len(kv[1]),
            reverse=True,
        )
    ]


def get_dora_metrics(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> dict:
    cutoff = datetime.now(UTC) - timedelta(days=since_days) if since_days is not None else None

    # ── All workflow run events ───────────────────────────────────────────────
    wf_q = db.query(
        GitHubEvent.created_at,
        GitHubEvent.branch,
        GitHubEvent.conclusion,
        GitHubEvent.commit_sha,
        GitHubEvent.details_json,
    ).filter(GitHubEvent.event_type == "workflow_run")

    if installation_ids is not None:
        wf_q = wf_q.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        wf_q = wf_q.filter(GitHubEvent.repo_name == repo_name)
    if cutoff:
        wf_q = wf_q.filter(GitHubEvent.created_at >= cutoff)

    wf_rows = wf_q.order_by(GitHubEvent.created_at).all()

    # ── Deploy Frequency ─────────────────────────────────────────────────────
    deploy_rows = [r for r in wf_rows if r.conclusion == "success" and r.branch in ("main", "master")]

    deploy_by_day: dict[str, int] = defaultdict(int)
    for r in deploy_rows:
        if r.created_at:
            deploy_by_day[r.created_at.strftime("%Y-%m-%d")] += 1
    deploy_trend = [{"date": d, "value": c} for d, c in sorted(deploy_by_day.items())]

    if deploy_rows:
        if since_days:
            deploy_per_day = len(deploy_rows) / since_days
        else:
            dates = [r.created_at for r in deploy_rows if r.created_at]
            span = max(1, (max(dates) - min(dates)).days + 1) if len(dates) > 1 else 1
            deploy_per_day = len(deploy_rows) / span
    else:
        deploy_per_day = 0.0

    # ── Change Failure Rate ──────────────────────────────────────────────────
    completed = [r for r in wf_rows if r.conclusion in ("success", "failure")]
    cfr_pct = (sum(1 for r in completed if r.conclusion == "failure") / len(completed) * 100) if completed else 0.0

    cfr_by_day: dict[str, dict] = defaultdict(lambda: {"total": 0, "failed": 0})
    for r in completed:
        if r.created_at:
            d = r.created_at.strftime("%Y-%m-%d")
            cfr_by_day[d]["total"] += 1
            if r.conclusion == "failure":
                cfr_by_day[d]["failed"] += 1
    cfr_trend = [
        {"date": d, "value": round(v["failed"] / v["total"] * 100, 1)}
        for d, v in sorted(cfr_by_day.items()) if v["total"] > 0
    ]

    # ── MTTR ─────────────────────────────────────────────────────────────────
    groups: dict[tuple, list] = defaultdict(list)
    for r in wf_rows:
        wf_name = (r.details_json or {}).get("workflow_run", {}).get("name", "")
        groups[(r.branch or "", wf_name)].append(r)

    mttr_by_day: dict[str, list[float]] = defaultdict(list)
    for group in groups.values():
        last_fail_time = None
        for r in group:
            if r.conclusion == "failure" and r.created_at:
                last_fail_time = r.created_at
            elif r.conclusion == "success" and last_fail_time is not None and r.created_at:
                delta_h = (r.created_at - last_fail_time).total_seconds() / 3600
                mttr_by_day[last_fail_time.strftime("%Y-%m-%d")].append(delta_h)
                last_fail_time = None

    mttr_trend = [{"date": d, "value": round(sum(ts) / len(ts), 1)} for d, ts in sorted(mttr_by_day.items())]
    all_mttr = [h for ts in mttr_by_day.values() for h in ts]
    avg_mttr = round(sum(all_mttr) / len(all_mttr), 1) if all_mttr else None

    # ── Lead Time for Changes ─────────────────────────────────────────────────
    push_q = db.query(GitHubEvent.commit_sha, GitHubEvent.created_at).filter(
        GitHubEvent.event_type == "push",
    )
    if installation_ids is not None:
        push_q = push_q.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        push_q = push_q.filter(GitHubEvent.repo_name == repo_name)

    push_sha_map: dict[str, datetime] = {}
    for sha, created_at in push_q.all():
        if sha and created_at:
            push_sha_map[sha] = created_at

    lt_by_day: dict[str, list[float]] = defaultdict(list)
    for r in deploy_rows:
        if not r.commit_sha or not r.created_at:
            continue
        push_time = push_sha_map.get(r.commit_sha)
        if push_time is None:
            continue
        updated_at_str = (r.details_json or {}).get("workflow_run", {}).get("updated_at")
        if not updated_at_str:
            continue
        try:
            completed_at = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
            tz_push = push_time.replace(tzinfo=UTC) if push_time.tzinfo is None else push_time
            lead_h = (completed_at - tz_push).total_seconds() / 3600
            if lead_h >= 0:
                lt_by_day[completed_at.strftime("%Y-%m-%d")].append(lead_h)
        except (ValueError, AttributeError):
            continue

    lt_trend = [{"date": d, "value": round(sum(ts) / len(ts), 1)} for d, ts in sorted(lt_by_day.items())]
    all_lt = [h for ts in lt_by_day.values() for h in ts]
    avg_lt = round(sum(all_lt) / len(all_lt), 1) if all_lt else None

    # ── DORA band ratings ─────────────────────────────────────────────────────
    def rate_deploy(v: float) -> str:
        if v >= 1: return "elite"
        if v >= 1 / 7: return "high"
        if v >= 1 / 30: return "medium"
        return "low"

    def rate_cfr(v: float) -> str:
        if v <= 5: return "elite"
        if v <= 10: return "high"
        if v <= 15: return "medium"
        return "low"

    def rate_hours(v: float | None) -> str:
        if v is None: return "low"
        if v < 1: return "elite"
        if v < 24: return "high"
        if v < 168: return "medium"
        return "low"

    return {
        "deploy_frequency": {"value": round(deploy_per_day, 2), "rating": rate_deploy(deploy_per_day), "trend": deploy_trend},
        "change_failure_rate": {"value": round(cfr_pct, 1), "rating": rate_cfr(cfr_pct), "trend": cfr_trend},
        "mttr": {"value": avg_mttr, "rating": rate_hours(avg_mttr), "trend": mttr_trend},
        "lead_time": {"value": avg_lt, "rating": rate_hours(avg_lt), "trend": lt_trend},
    }


def get_timeline(
    repo_name: str | None = None,
    since_days: int | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.created_at, GitHubEvent.event_type)

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if since_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=since_days)
        query = query.filter(GitHubEvent.created_at >= cutoff)

    rows = query.all()

    pivot: dict[str, dict[str, int]] = defaultdict(
        lambda: {et: 0 for et in _TIMELINE_EVENT_TYPES}
    )

    for created_at, event_type in rows:
        if created_at is not None and event_type in _TIMELINE_EVENT_TYPES:
            date_str = created_at.strftime('%Y-%m-%d')
            pivot[date_str][event_type] += 1

    return [{"date": date, **counts} for date, counts in sorted(pivot.items())]