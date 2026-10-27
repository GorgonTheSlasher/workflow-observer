import re
from collections import defaultdict
from datetime import datetime, UTC

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
    branch: str | None = None,
    workflow_name: str | None = None,
    search: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if branch:
        query = query.filter(GitHubEvent.branch == branch)

    if workflow_name:
        query = query.filter(
            # Tuple path + as_string() is portable; .astext only exists on the Postgres JSON type
            GitHubEvent.details_json[("workflow_run", "name")].as_string() == workflow_name
        )

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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

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
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

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
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

    rows = (
        query
        .group_by(GitHubEvent.event_type)
        .order_by(func.count(GitHubEvent.id).desc())
        .all()
    )

    return [{"event_type": event_type, "count": count} for event_type, count in rows]

def get_workflow_failures_by_name(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

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
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

    rows = (
        query
        .group_by(GitHubEvent.branch)
        .order_by(func.count(GitHubEvent.id).desc())
        .all()
    )

    return [{"branch": branch or "Unknown", "count": count} for branch, count in rows]

def get_workflow_run_timeline(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

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
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

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
    start_date: datetime | None = None,
    end_date: datetime | None = None,
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

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

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


_MAIN_BRANCHES = ("main", "master")

# Workflow names treated as deployments, e.g. "Deploy", "Release", "Publish to npm", "CI/CD"
_DEPLOY_WORKFLOW_PATTERN = re.compile(r"deploy|release|publish|\bcd\b", re.IGNORECASE)


def _run_workflow_name(row) -> str:
    return ((row.details_json or {}).get("workflow_run") or {}).get("name") or ""


def _is_deploy_workflow(name: str) -> bool:
    return bool(_DEPLOY_WORKFLOW_PATTERN.search(name))


def _as_utc(dt: datetime) -> datetime:
    # Stored datetimes come back naive but are UTC
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


def _parse_github_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return _as_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except (ValueError, AttributeError):
        return None


def get_dora_metrics(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> dict:
    # ── All workflow run events ───────────────────────────────────────────────
    wf_q = db.query(
        GitHubEvent.created_at,
        GitHubEvent.repo_name,
        GitHubEvent.branch,
        GitHubEvent.conclusion,
        GitHubEvent.commit_sha,
        GitHubEvent.details_json,
    ).filter(GitHubEvent.event_type == "workflow_run")

    if installation_ids is not None:
        wf_q = wf_q.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        wf_q = wf_q.filter(GitHubEvent.repo_name == repo_name)
    if start_date is not None:
        wf_q = wf_q.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        wf_q = wf_q.filter(GitHubEvent.created_at < end_date)

    wf_rows = wf_q.order_by(GitHubEvent.created_at).all()

    # ── Deployments ──────────────────────────────────────────────────────────
    # A deployment is a run of a deploy-like workflow on main/master. Counting every workflow
    # on main would count CI, lint etc. as deploys too. Repos with no deploy-like workflow
    # fall back to all main/master runs, decided per repo so mixed repos stay accurate.
    main_runs = [r for r in wf_rows if r.branch in _MAIN_BRANCHES]
    repos_with_deploy_workflow = {
        r.repo_name for r in main_runs if _is_deploy_workflow(_run_workflow_name(r))
    }
    deploy_attempts = [
        r for r in main_runs
        if r.conclusion in ("success", "failure")
        and (r.repo_name not in repos_with_deploy_workflow or _is_deploy_workflow(_run_workflow_name(r)))
    ]
    deploy_rows = [r for r in deploy_attempts if r.conclusion == "success"]
    deploy_workflows = sorted({_run_workflow_name(r) for r in deploy_attempts if _run_workflow_name(r)})
    deploy_fallback = any(r.repo_name not in repos_with_deploy_workflow for r in deploy_attempts)

    # ── Deploy Frequency ─────────────────────────────────────────────────────
    deploy_by_day: dict[str, int] = defaultdict(int)
    for r in deploy_rows:
        if r.created_at:
            deploy_by_day[r.created_at.strftime("%Y-%m-%d")] += 1
    deploy_trend = [{"date": d, "value": c} for d, c in sorted(deploy_by_day.items())]

    if deploy_rows:
        if start_date is not None and end_date is not None:
            span = max(1, (end_date - start_date).days)
        elif start_date is not None:
            span = max(1, (datetime.now(UTC) - start_date).days + 1)
        else:
            dates = [r.created_at for r in deploy_rows if r.created_at]
            span = max(1, (max(dates) - min(dates)).days + 1) if len(dates) > 1 else 1
        deploy_per_day = len(deploy_rows) / span
    else:
        deploy_per_day = 0.0

    # ── Change Failure Rate ──────────────────────────────────────────────────
    # Share of deployments that failed. CI failures on feature branches are not failed changes.
    cfr_pct = (
        sum(1 for r in deploy_attempts if r.conclusion == "failure") / len(deploy_attempts) * 100
    ) if deploy_attempts else 0.0

    cfr_by_day: dict[str, dict] = defaultdict(lambda: {"total": 0, "failed": 0})
    for r in deploy_attempts:
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
    # Time from the first failed deployment in a streak to the next successful one. Grouped
    # per repo and workflow so one repo's success does not close another repo's incident.
    groups: dict[tuple, list] = defaultdict(list)
    for r in deploy_attempts:
        groups[(r.repo_name, _run_workflow_name(r))].append(r)

    mttr_by_day: dict[str, list[float]] = defaultdict(list)
    for group in groups.values():
        failed_since = None
        for r in group:
            if not r.created_at:
                continue
            if r.conclusion == "failure" and failed_since is None:
                failed_since = r.created_at
            elif r.conclusion == "success" and failed_since is not None:
                delta_h = (r.created_at - failed_since).total_seconds() / 3600
                mttr_by_day[failed_since.strftime("%Y-%m-%d")].append(delta_h)
                failed_since = None

    mttr_trend = [{"date": d, "value": round(sum(ts) / len(ts), 1)} for d, ts in sorted(mttr_by_day.items())]
    all_mttr = [h for ts in mttr_by_day.values() for h in ts]
    avg_mttr = round(sum(all_mttr) / len(all_mttr), 1) if all_mttr else None

    # ── Lead Time for Changes ─────────────────────────────────────────────────
    # From a change's first commit to its successful deployment. For a merged PR that is the
    # first push to its branch; for a direct push to main it is the push itself. Pushes and PRs
    # are not date filtered, since a change deployed in the window may have started before it.
    push_q = db.query(
        GitHubEvent.repo_name, GitHubEvent.branch, GitHubEvent.commit_sha, GitHubEvent.created_at,
    ).filter(GitHubEvent.event_type == "push")
    pr_q = db.query(GitHubEvent.repo_name, GitHubEvent.details_json).filter(
        GitHubEvent.event_type == "pull_request",
        GitHubEvent.action == "closed",
    )
    if installation_ids is not None:
        push_q = push_q.filter(GitHubEvent.installation_id.in_(installation_ids))
        pr_q = pr_q.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        push_q = push_q.filter(GitHubEvent.repo_name == repo_name)
        pr_q = pr_q.filter(GitHubEvent.repo_name == repo_name)

    push_time_by_sha: dict[str, datetime] = {}
    push_times_by_branch: dict[tuple, list[datetime]] = defaultdict(list)
    for repo, branch, sha, created_at in push_q.all():
        if not created_at:
            continue
        created_at = _as_utc(created_at)
        if sha:
            push_time_by_sha[sha] = created_at
        if branch:
            push_times_by_branch[(repo, branch)].append(created_at)
    for times in push_times_by_branch.values():
        times.sort()

    merged_by_branch: dict[tuple, list[tuple]] = defaultdict(list)
    for repo, details_json in pr_q.all():
        pr = (details_json or {}).get("pull_request") or {}
        merge_sha = pr.get("merge_commit_sha")
        head_ref = (pr.get("head") or {}).get("ref")
        merged_at = _parse_github_time(pr.get("merged_at"))
        if merge_sha and head_ref and merged_at:
            merged_by_branch[(repo, head_ref)].append((merged_at, merge_sha, _parse_github_time(pr.get("created_at"))))

    # A branch can be reused for later PRs, so only pushes since its previous merge count
    first_commit_by_merge_sha: dict[str, datetime] = {}
    for key, merges in merged_by_branch.items():
        previous_merge = None
        for merged_at, merge_sha, opened_at in sorted(merges, key=lambda m: m[0]):
            pushes = [
                t for t in push_times_by_branch.get(key, [])
                if t <= merged_at and (previous_merge is None or t > previous_merge)
            ]
            first_commit = pushes[0] if pushes else opened_at
            if first_commit:
                first_commit_by_merge_sha[merge_sha] = first_commit
            previous_merge = merged_at

    lt_by_day: dict[str, list[float]] = defaultdict(list)
    for r in deploy_rows:
        if not r.commit_sha:
            continue
        change_started = first_commit_by_merge_sha.get(r.commit_sha) or push_time_by_sha.get(r.commit_sha)
        completed_at = _parse_github_time(((r.details_json or {}).get("workflow_run") or {}).get("updated_at"))
        if change_started is None or completed_at is None:
            continue
        lead_h = (completed_at - change_started).total_seconds() / 3600
        if lead_h >= 0:
            lt_by_day[completed_at.strftime("%Y-%m-%d")].append(lead_h)

    lt_trend = [{"date": d, "value": round(sum(ts) / len(ts), 1)} for d, ts in sorted(lt_by_day.items())]
    all_lt = [h for ts in lt_by_day.values() for h in ts]
    avg_lt = round(sum(all_lt) / len(all_lt), 1) if all_lt else None

    # ── DORA band ratings ─────────────────────────────────────────────────────
    def rate_deploy(v: float) -> str:
        if v >= 1:
            return "elite"
        if v >= 1 / 7:
            return "high"
        if v >= 1 / 30:
            return "medium"
        return "low"

    def rate_cfr(v: float) -> str:
        if v <= 5:
            return "elite"
        if v <= 10:
            return "high"
        if v <= 15:
            return "medium"
        return "low"

    def rate_hours(v: float | None) -> str:
        if v is None:
            return "low"
        if v < 1:
            return "elite"
        if v < 24:
            return "high"
        if v < 168:
            return "medium"
        return "low"

    return {
        "deploy_frequency": {
            "value": round(deploy_per_day, 2),
            "rating": rate_deploy(deploy_per_day),
            "trend": deploy_trend,
            "workflows": deploy_workflows,
            "fallback": deploy_fallback,
        },
        "change_failure_rate": {"value": round(cfr_pct, 1), "rating": rate_cfr(cfr_pct), "trend": cfr_trend},
        "mttr": {"value": avg_mttr, "rating": rate_hours(avg_mttr), "trend": mttr_trend},
        "lead_time": {"value": avg_lt, "rating": rate_hours(avg_lt), "trend": lt_trend},
    }


def get_timeline(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.created_at, GitHubEvent.event_type)

    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))

    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)

    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)

    rows = query.all()

    pivot: dict[str, dict[str, int]] = defaultdict(
        lambda: {et: 0 for et in _TIMELINE_EVENT_TYPES}
    )

    for created_at, event_type in rows:
        if created_at is not None and event_type in _TIMELINE_EVENT_TYPES:
            date_str = created_at.strftime('%Y-%m-%d')
            pivot[date_str][event_type] += 1

    return [{"date": date, **counts} for date, counts in sorted(pivot.items())]


# ── Issues analytics ──────────────────────────────────────────────────────────

def _apply_base_filters(query, repo_name, start_date, end_date, installation_ids):
    if installation_ids is not None:
        query = query.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        query = query.filter(GitHubEvent.repo_name == repo_name)
    if start_date is not None:
        query = query.filter(GitHubEvent.created_at >= start_date)
    if end_date is not None:
        query = query.filter(GitHubEvent.created_at < end_date)
    return query


def get_issue_stats(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> dict:
    query = db.query(GitHubEvent).filter(
        GitHubEvent.event_type == "issues",
        GitHubEvent.action.in_(["opened", "closed"]),
    )
    query = _apply_base_filters(query, repo_name, start_date, end_date, installation_ids)
    events = query.order_by(GitHubEvent.created_at).all()

    opened_count = sum(1 for e in events if e.action == "opened")
    closed_count = sum(1 for e in events if e.action == "closed")
    close_rate = round(closed_count / opened_count * 100, 1) if opened_count > 0 else None

    opened_times: dict[int, datetime] = {}
    close_durations: list[float] = []
    for e in events:
        num = (e.details_json or {}).get("issue", {}).get("number")
        if num is None:
            continue
        if e.action == "opened":
            opened_times[num] = e.created_at
        elif e.action == "closed" and num in opened_times:
            hours = (e.created_at - opened_times[num]).total_seconds() / 3600
            if hours >= 0:
                close_durations.append(hours)

    avg_close_time = round(sum(close_durations) / len(close_durations), 1) if close_durations else None

    return {
        "opened": opened_count,
        "closed": closed_count,
        "close_rate": close_rate,
        "avg_close_time": avg_close_time,
    }


def get_issue_activity_timeline(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.action, GitHubEvent.created_at).filter(
        GitHubEvent.event_type == "issues",
        GitHubEvent.action.in_(["opened", "closed"]),
    )
    query = _apply_base_filters(query, repo_name, start_date, end_date, installation_ids)

    by_day: dict[str, dict[str, int]] = defaultdict(lambda: {"opened": 0, "closed": 0})
    for action, created_at in query.all():
        if created_at is not None:
            day = created_at.strftime("%Y-%m-%d")
            by_day[day][action] += 1

    return [
        {"date": day, "opened": counts["opened"], "closed": counts["closed"]}
        for day, counts in sorted(by_day.items())
    ]


def get_issue_labels(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    query = db.query(GitHubEvent.details_json).filter(
        GitHubEvent.event_type == "issues",
        GitHubEvent.action == "opened",
    )
    query = _apply_base_filters(query, repo_name, start_date, end_date, installation_ids)

    counts: dict[str, int] = defaultdict(int)
    for (details_json,) in query.all():
        labels = (details_json or {}).get("issue", {}).get("labels", [])
        for label in labels:
            name = label.get("name") if isinstance(label, dict) else None
            if name:
                counts[name] += 1

    return [
        {"label": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ][:15]


def get_issue_resolution_trend(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
) -> list[dict]:
    # Load ALL opened events (no date filter) to pair with any close in the window
    opened_query = db.query(GitHubEvent.details_json, GitHubEvent.created_at).filter(
        GitHubEvent.event_type == "issues",
        GitHubEvent.action == "opened",
    )
    if installation_ids is not None:
        opened_query = opened_query.filter(GitHubEvent.installation_id.in_(installation_ids))
    if repo_name:
        opened_query = opened_query.filter(GitHubEvent.repo_name == repo_name)

    opened_times: dict[int, datetime] = {}
    for details_json, created_at in opened_query.all():
        num = (details_json or {}).get("issue", {}).get("number")
        if num is not None and created_at is not None:
            opened_times[num] = created_at

    closed_query = db.query(GitHubEvent.details_json, GitHubEvent.created_at).filter(
        GitHubEvent.event_type == "issues",
        GitHubEvent.action == "closed",
    )
    closed_query = _apply_base_filters(closed_query, repo_name, start_date, end_date, installation_ids)

    by_day: dict[str, list[float]] = defaultdict(list)
    for details_json, closed_at in closed_query.all():
        num = (details_json or {}).get("issue", {}).get("number")
        if num is None or num not in opened_times or closed_at is None:
            continue
        hours = (closed_at - opened_times[num]).total_seconds() / 3600
        if hours >= 0:
            day = closed_at.strftime("%Y-%m-%d")
            by_day[day].append(hours)

    return [
        {"date": day, "avg_hours": round(sum(hrs) / len(hrs), 1)}
        for day, hrs in sorted(by_day.items())
    ]


def get_issue_reporters(
    repo_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    installation_ids: list[int] | None = None,
    limit: int = 10,
) -> list[dict]:
    query = db.query(
        GitHubEvent.actor,
        func.count(GitHubEvent.id).label("count"),
    ).filter(
        GitHubEvent.event_type == "issues",
        GitHubEvent.action == "opened",
        GitHubEvent.actor.isnot(None),
    )
    query = _apply_base_filters(query, repo_name, start_date, end_date, installation_ids)

    rows = (
        query
        .group_by(GitHubEvent.actor)
        .order_by(func.count(GitHubEvent.id).desc())
        .limit(limit)
        .all()
    )
    return [{"actor": actor, "count": count} for actor, count in rows]
