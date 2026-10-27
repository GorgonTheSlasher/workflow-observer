"""
Seeds the demo tenant with realistic, connected GitHub activity.

Rather than inserting random rows, this simulates a small team working on each repo:
feature branches get pushed, CI runs on every push, failing CI gets fixed, PRs are opened,
reviewed and merged, merges to main deploy, some deploys fail and get recovered, and
issues are opened, labeled and closed. Every event is built as a GitHub-shaped webhook
payload and sent through the real event handlers, so seeded rows look exactly like
ingested ones.

Run from the backend directory with the venv active and the schema up to date:

    alembic upgrade head
    python scripts/seed_demo.py --installation-id 12345 --reset

Targets the local SQLite file unless --db-url is given, so it can't seed production
by accident through .env. Pass --dry-run to see what would be generated without writing.
"""
import argparse
import os
import random
import sys
import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

# Resolve the target database before app modules load so load_dotenv() in
# config.py cannot override the choice.
_parser = argparse.ArgumentParser(description="Seed the Workflow Observer demo tenant.")
_parser.add_argument("--db-url", help="Database URL to seed. Defaults to the local SQLite file.")
_parser.add_argument(
    "--installation-id",
    type=int,
    help="Installation the events belong to. Defaults to the first DEMO_INSTALLATION_IDS entry.",
)
_parser.add_argument(
    "--repo",
    action="append",
    dest="repos",
    help="Repository full name to simulate (repeatable). Defaults to the demo repo.",
)
_parser.add_argument("--days", type=int, default=45, help="How many days of history to generate (default 45).")
_parser.add_argument("--seed", type=int, help="Random seed for reproducible data.")
_mode = _parser.add_mutually_exclusive_group()
_mode.add_argument("--reset", action="store_true", help="Delete previously seeded events for this installation first.")
_mode.add_argument("--append", action="store_true", help="Add to previously seeded events instead of refusing.")
_parser.add_argument("--dry-run", action="store_true", help="Generate and summarise without writing to the database.")
_args = _parser.parse_args()

if _args.db_url:
    os.environ["DATABASE_URL"] = _args.db_url
else:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(BACKEND_DIR, 'workflow_observer.db')}"

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.event_handlers import EVENT_HANDLERS  # noqa: E402
from app.models import GitHubEvent  # noqa: E402
from app.services.event_services import save_event  # noqa: E402

# ── Config ─────────────────────────────────────────────────────────────────────

DEFAULT_REPOS = ["GorgonTheSlasher/workflow-observer-test-repo"]

# Seeded rows are tagged through their delivery id so --reset never touches real events
SEED_DELIVERY_PREFIX = "seed-"

# (login, weight). Weight is how often they pick up new work.
TEAM = [
    ("maya-chen",      0.30),
    ("dev-okafor",     0.25),
    ("sam-rivera",     0.20),
    ("priya-natarajan", 0.15),
]
MAINTAINERS = ["maya-chen", "dev-okafor"]  # who reviews/merges and triages issues

# Joins part way through the window, so the member alert and a new actor show up
LATE_JOINER = "jordan-blake"

DEPENDABOT = "dependabot[bot]"
OUTSIDE_REPORTERS = ["customer-success-bot", "lee-from-support", "qa-tester-ana"]

WORK_START_HOUR = 9
WORK_END_HOUR = 18

# name: (mean seconds, std seconds)
WORKFLOW_DURATIONS = {
    "CI":     (240, 50),
    "Lint":   (50, 10),
    "Deploy": (330, 60),
}

# Chance a run fails. Feature branches break more often than main.
FAILURE_RATES = {
    ("CI", "branch"):   0.18,
    ("CI", "main"):     0.04,
    ("Lint", "branch"): 0.08,
    ("Lint", "main"):   0.01,
    ("Deploy", "main"): 0.12,
}

# Branch names and PR titles are built from these, e.g. feature/orders-csv-export
# "Add CSV export to orders". Enough combinations that names rarely repeat.
AREAS = ["checkout", "cart", "orders", "billing", "search", "auth", "admin", "api", "notifications", "reports", "inventory"]

# (prefix, slug, title template, weight)
WORK_KINDS = [
    ("feature",  "csv-export",       "Add CSV export to {area}",           3),
    ("feature",  "filters",          "Add filters to {area}",              3),
    ("feature",  "pagination",       "Paginate {area} results",            2),
    ("feature",  "audit-log",        "Audit log for {area} changes",       2),
    ("feature",  "webhooks",         "Emit webhooks for {area} events",    2),
    ("feature",  "caching",          "Cache {area} lookups",               2),
    ("feature",  "bulk-actions",     "Bulk actions in {area}",             1),
    ("fix",      "timezone",         "Fix timezone handling in {area}",    2),
    ("fix",      "null-check",       "Handle missing fields in {area}",    3),
    ("fix",      "race-condition",   "Fix race condition in {area}",       1),
    ("fix",      "flaky-tests",      "Stabilise flaky {area} tests",       2),
    ("fix",      "error-messages",   "Clearer {area} error messages",      2),
    ("refactor", "service-layer",    "Move {area} logic into a service",   1),
    ("chore",    "logging",          "Structured logging for {area}",      1),
]

DEPENDENCIES = ["axios", "react-router", "pydantic", "sqlalchemy", "eslint", "vite", "requests", "pytest"]

ISSUE_TOPICS = [
    ("bug",           "Checkout button unresponsive on Safari"),
    ("bug",           "Order confirmation email sent twice"),
    ("bug",           "500 error when cart is empty"),
    ("bug",           "Webhook signature check fails intermittently"),
    ("bug",           "Dashboard totals off by one day"),
    ("enhancement",   "Allow filtering orders by status"),
    ("enhancement",   "Add dark mode to admin panel"),
    ("enhancement",   "Support partial refunds"),
    ("documentation", "Document webhook payload format"),
    ("documentation", "Update local setup instructions"),
    ("performance",   "Orders page slow with 10k+ rows"),
    ("performance",   "Reduce bundle size on product page"),
]

# ── Payload builders ───────────────────────────────────────────────────────────
# Only the fields GitHub sends that the handlers and analytics read, plus enough
# context (titles, messages, urls) for the event detail panel to look real.

def iso(ts: datetime) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%SZ")


def user(login: str) -> dict:
    return {
        "login": login,
        "type": "Bot" if login.endswith("[bot]") else "User",
        "html_url": f"https://github.com/{login.replace('[bot]', '')}",
    }


class RepoSim:
    """Generates the event stream for one repository."""

    def __init__(self, full_name: str, rng: random.Random, installation_id: int, start: datetime, now: datetime):
        self.full_name = full_name
        self.url = f"https://github.com/{full_name}"
        self.rng = rng
        self.installation_id = installation_id
        self.start = start
        self.now = now

        self.events: list[tuple[datetime, str, dict]] = []
        self.main_sha = self.sha()
        self.next_number = rng.randint(40, 180)  # PRs and issues share a counter, as on GitHub
        self.next_run_id = rng.randint(9_000_000_000, 9_900_000_000)
        self.run_numbers: Counter = Counter({name: rng.randint(200, 900) for name in WORKFLOW_DURATIONS})
        self.used_branches: set[str] = set()
        self.team = list(TEAM)
        self.join_time = start + (now - start) * rng.uniform(0.35, 0.6)
        self.stats: Counter = Counter()

    # ── helpers ──

    def sha(self) -> str:
        return f"{self.rng.getrandbits(160):040x}"

    def number(self) -> int:
        self.next_number += 1
        return self.next_number

    def repository(self) -> dict:
        owner = self.full_name.split("/")[0]
        return {
            "name": self.full_name.split("/")[1],
            "full_name": self.full_name,
            "html_url": self.url,
            "owner": {"login": owner},
            "default_branch": "main",
            "private": False,
        }

    def emit(self, ts: datetime, event_type: str, payload: dict) -> None:
        if ts > self.now:
            return  # story hasn't happened yet, e.g. a PR still open today
        payload["repository"] = self.repository()
        payload["installation"] = {"id": self.installation_id}
        self.events.append((ts, event_type, payload))
        self.stats[event_type] += 1

    def working_time(self, ts: datetime) -> datetime:
        """Moves a human action into the next working hours window."""
        while True:
            if ts.weekday() >= 5:
                ts = (ts + timedelta(days=7 - ts.weekday())).replace(hour=WORK_START_HOUR, minute=self.rng.randint(0, 59))
            elif ts.hour < WORK_START_HOUR:
                ts = ts.replace(hour=WORK_START_HOUR, minute=self.rng.randint(0, 59))
            elif ts.hour >= WORK_END_HOUR:
                ts = (ts + timedelta(days=1)).replace(hour=WORK_START_HOUR, minute=self.rng.randint(0, 59))
            else:
                return ts

    def developers(self, at: datetime) -> list[tuple[str, float]]:
        if at >= self.join_time:
            return self.team + [(LATE_JOINER, 0.15)]
        return self.team

    def pick_developer(self, at: datetime) -> str:
        names, weights = zip(*self.developers(at))
        return self.rng.choices(names, weights=weights, k=1)[0]

    def pick_reviewer(self, author: str) -> str:
        return self.rng.choice([m for m in MAINTAINERS if m != author] or MAINTAINERS)

    def branch_name(self, prefix: str, slug: str) -> str:
        name = f"{prefix}/{slug}"
        suffix = 2
        while name in self.used_branches:
            name = f"{prefix}/{slug}-{suffix}"
            suffix += 1
        self.used_branches.add(name)
        return name

    # ── single events ──

    def push(
        self, ts: datetime, actor: str, branch: str, message: str, forced: bool = False, sha: str | None = None,
    ) -> str:
        sha = sha or self.sha()
        before = self.main_sha if branch == "main" else self.sha()
        commit = {
            "id": sha,
            "message": message,
            "timestamp": iso(ts),
            "url": f"{self.url}/commit/{sha}",
            "author": {"name": actor, "username": actor},
        }
        self.emit(ts, "push", {
            "ref": f"refs/heads/{branch}",
            "before": before,
            "after": sha,
            "forced": forced,
            "created": False,
            "deleted": False,
            "compare": f"{self.url}/compare/{before[:12]}...{sha[:12]}",
            "commits": [commit],
            "head_commit": commit,
            "pusher": {"name": actor},
            "sender": user(actor),
        })
        if branch == "main":
            self.main_sha = sha
        return sha

    def workflow_run(self, triggered_at: datetime, name: str, branch: str, sha: str, actor: str) -> tuple[datetime, str]:
        """Runs a workflow for a commit. Returns (completed_at, conclusion)."""
        scope = "main" if branch == "main" else "branch"
        failed = self.rng.random() < FAILURE_RATES.get((name, scope), 0.05)
        conclusion = "failure" if failed else "success"
        if not failed and self.rng.random() < 0.02:
            conclusion = "cancelled"

        mean, std = WORKFLOW_DURATIONS[name]
        duration = max(15, int(self.rng.gauss(mean, std)))
        if failed:
            duration = int(duration * self.rng.uniform(0.3, 0.9))  # failures usually stop early
        started_at = triggered_at + timedelta(seconds=self.rng.randint(5, 40))
        completed_at = started_at + timedelta(seconds=duration)

        self.next_run_id += self.rng.randint(1, 400)
        self.run_numbers[name] += 1
        run_id = self.next_run_id

        self.emit(completed_at, "workflow_run", {
            "action": "completed",
            "workflow_run": {
                "id": run_id,
                "name": name,
                "head_branch": branch,
                "head_sha": sha,
                "event": "push",
                "status": "completed",
                "conclusion": conclusion,
                "run_number": self.run_numbers[name],
                "run_attempt": 1,
                "html_url": f"{self.url}/actions/runs/{run_id}",
                "created_at": iso(triggered_at),
                "run_started_at": iso(started_at),
                "updated_at": iso(completed_at),
                "actor": user(actor),
                "triggering_actor": user(actor),
            },
            "workflow": {"name": name, "path": f".github/workflows/{name.lower()}.yml"},
            "sender": user(actor),
        })
        self.stats[f"run_{conclusion}"] += 1
        return completed_at, conclusion

    def checks(self, ts: datetime, branch: str, sha: str, actor: str) -> tuple[datetime, bool]:
        """CI and Lint on every push. Returns (last completion, all passed)."""
        ci_done, ci = self.workflow_run(ts, "CI", branch, sha, actor)
        lint_done, lint = self.workflow_run(ts, "Lint", branch, sha, actor)
        return max(ci_done, lint_done), ci == "success" and lint == "success"

    def pull_request(self, ts: datetime, action: str, pr: dict, sender: str) -> None:
        self.emit(ts, "pull_request", {
            "action": action,
            "number": pr["number"],
            "pull_request": dict(pr, head=dict(pr["head"]), labels=list(pr["labels"])),
            "sender": user(sender),
        })

    def issue_event(self, ts: datetime, action: str, issue: dict, sender: str, label: dict | None = None) -> None:
        payload = {"action": action, "issue": dict(issue, labels=list(issue["labels"])), "sender": user(sender)}
        if label:
            payload["label"] = label
        self.emit(ts, "issues", payload)

    # ── stories ──

    def deploy_main(self, ts: datetime, sha: str, actor: str) -> None:
        """A merge to main runs checks then deploys. Failed deploys get a follow-up fix."""
        checks_done, _ = self.checks(ts, "main", sha, actor)
        deploy_done, conclusion = self.workflow_run(checks_done, "Deploy", "main", sha, actor)
        self.stats["deploys"] += 1

        if conclusion == "failure":
            self.stats["deploy_failures"] += 1
            fixer = self.rng.choice(MAINTAINERS + [actor])
            # Someone notices, investigates and ships a fix
            fix_at = deploy_done + timedelta(minutes=self.rng.choice([20, 45, 90, 180, 360]))
            message = self.rng.choice([
                "Revert last merge to unblock deploy",
                "Fix missing env var in deploy config",
                "Fix migration ordering",
                "Pin dependency that broke the build",
            ])
            fix_sha = self.push(fix_at, fixer, "main", message)
            fix_checks_done, _ = self.checks(fix_at, "main", fix_sha, fixer)
            recovered_at, recovered = self.workflow_run(fix_checks_done, "Deploy", "main", fix_sha, fixer)
            if recovered == "success":
                self.stats["recoveries"] += 1

    def merge(self, merged_at: datetime, pr: dict, branch: str, reviewer: str) -> None:
        """Merges a PR: the closed event carries merge_commit_sha, which is the sha GitHub
        pushes to main and deploys. That link is what lead time uses to find the PR."""
        merge_sha = self.sha()
        pr["merged"] = True
        pr["merged_at"] = iso(merged_at)
        pr["merge_commit_sha"] = merge_sha
        self.pull_request(merged_at, "closed", pr, reviewer)
        self.stats["prs_merged"] += 1
        self.push(merged_at, reviewer, "main", f"Merge pull request #{pr['number']} from {branch}", sha=merge_sha)
        self.deploy_main(merged_at, merge_sha, reviewer)

    def feature_pr(self, start: datetime) -> None:
        author = self.pick_developer(start)
        prefix, slug, title_template, _ = self.rng.choices(WORK_KINDS, weights=[k[3] for k in WORK_KINDS], k=1)[0]
        area = self.rng.choice(AREAS)
        branch = self.branch_name(prefix, f"{area}-{slug}")
        title = title_template.format(area=area)
        number = self.number()

        t = self.working_time(start)
        sha = self.push(t, author, branch, title)
        done, passed = self.checks(t, branch, sha, author)

        opened_at = t + timedelta(minutes=self.rng.randint(2, 30))
        pr = {
            "number": number,
            "title": title,
            "state": "open",
            "user": user(author),
            "html_url": f"{self.url}/pull/{number}",
            "head": {"ref": branch, "sha": sha},
            "base": {"ref": "main"},
            "labels": [],
            "draft": False,
            "merged": False,
            "created_at": iso(opened_at),
            "closed_at": None,
            "merged_at": None,
        }
        self.pull_request(opened_at, "opened", pr, author)

        # Iterate: review feedback and red CI both cause follow-up pushes
        extra_pushes = self.rng.choices([0, 1, 2, 3], weights=[30, 35, 25, 10], k=1)[0]
        while extra_pushes > 0 or not passed:
            t = self.working_time(done + timedelta(minutes=self.rng.randint(15, 240)))
            message = "Fix failing tests" if not passed else self.rng.choice([
                "Address review feedback", "Add tests", "Tidy up naming", "Handle edge case",
            ])
            sha = self.push(t, author, branch, message)
            pr["head"]["sha"] = sha
            self.pull_request(t, "synchronize", pr, author)
            done, passed = self.checks(t, branch, sha, author)
            extra_pushes -= 1
            if extra_pushes < -3:
                break  # give up on a branch that just won't go green

        # Occasionally someone rebases and force pushes their feature branch
        if self.rng.random() < 0.08:
            t = self.working_time(done + timedelta(minutes=self.rng.randint(10, 90)))
            sha = self.push(t, author, branch, f"{title} (rebased)", forced=True)
            pr["head"]["sha"] = sha
            self.pull_request(t, "synchronize", pr, author)
            done, passed = self.checks(t, branch, sha, author)

        reviewer = self.pick_reviewer(author)
        closed_at = self.working_time(done + timedelta(hours=self.rng.lognormvariate(1.3, 0.9)))
        pr["state"] = "closed"
        pr["closed_at"] = iso(closed_at)

        if passed and self.rng.random() < 0.88:
            self.merge(closed_at, pr, branch, reviewer)
        else:
            self.pull_request(closed_at, "closed", pr, reviewer if self.rng.random() < 0.5 else author)
            self.stats["prs_abandoned"] += 1

    def dependabot_pr(self, start: datetime) -> None:
        dependency = self.rng.choice(DEPENDENCIES)
        branch = self.branch_name("dependabot/npm_and_yarn", dependency)
        number = self.number()
        title = f"Bump {dependency} from {self.rng.randint(1, 4)}.{self.rng.randint(0, 9)}.0 to {self.rng.randint(4, 7)}.0.0"

        sha = self.push(start, DEPENDABOT, branch, title)
        done, passed = self.checks(start, branch, sha, DEPENDABOT)
        pr = {
            "number": number,
            "title": title,
            "state": "open",
            "user": user(DEPENDABOT),
            "html_url": f"{self.url}/pull/{number}",
            "head": {"ref": branch, "sha": sha},
            "base": {"ref": "main"},
            "labels": [{"name": "dependencies"}],
            "draft": False,
            "merged": False,
            "created_at": iso(start),
            "closed_at": None,
            "merged_at": None,
        }
        self.pull_request(start + timedelta(seconds=30), "opened", pr, DEPENDABOT)

        reviewer = self.rng.choice(MAINTAINERS)
        closed_at = self.working_time(done + timedelta(hours=self.rng.uniform(4, 72)))
        pr["state"] = "closed"
        pr["closed_at"] = iso(closed_at)
        if passed:
            self.merge(closed_at, pr, branch, reviewer)
        else:
            self.pull_request(closed_at, "closed", pr, reviewer)
            self.stats["prs_abandoned"] += 1

    def issue(self, start: datetime) -> None:
        label_name, title = self.rng.choice(ISSUE_TOPICS)
        reporter = self.rng.choice(OUTSIDE_REPORTERS + [name for name, _ in self.developers(start)])
        number = self.number()
        opened_at = self.working_time(start)

        label = {"name": label_name}
        # Most issues come from a template that applies the label on open; the rest get triaged later
        from_template = self.rng.random() < 0.75

        issue = {
            "number": number,
            "title": title,
            "state": "open",
            "user": user(reporter),
            "html_url": f"{self.url}/issues/{number}",
            "labels": [label] if from_template else [],
            "created_at": iso(opened_at),
            "closed_at": None,
        }
        self.issue_event(opened_at, "opened", issue, reporter)

        labeled_at = opened_at
        if not from_template:
            labeled_at = self.working_time(opened_at + timedelta(minutes=self.rng.randint(10, 600)))
            issue["labels"].append(label)
            self.issue_event(labeled_at, "labeled", issue, self.rng.choice(MAINTAINERS), label=label)

        # Bugs get fixed faster than docs and enhancements, and some never close
        close_chance = {"bug": 0.85, "performance": 0.7}.get(label_name, 0.5)
        if self.rng.random() < close_chance:
            mean_days = {"bug": 0.6, "performance": 1.2}.get(label_name, 2.0)
            closed_at = self.working_time(labeled_at + timedelta(days=self.rng.lognormvariate(mean_days, 0.8)))
            issue["state"] = "closed"
            issue["closed_at"] = iso(closed_at)
            self.issue_event(closed_at, "closed", issue, self.rng.choice(MAINTAINERS))
            self.stats["issues_closed"] += 1

    def member_added(self, ts: datetime, login: str) -> None:
        self.emit(ts, "member", {
            "action": "added",
            "member": user(login),
            "changes": {"permission": {"to": "write"}},
            "sender": user(MAINTAINERS[0]),
        })

    # ── the simulation ──

    def run(self) -> None:
        day = self.start.replace(hour=0, minute=0, second=0, microsecond=0)
        while day <= self.now:
            weekday = day.weekday() < 5
            busy = 1.0 if weekday else 0.1

            for _ in range(self.rng.choices([0, 1, 2, 3, 4], weights=[10, 30, 35, 18, 7], k=1)[0]):
                if self.rng.random() < busy:
                    self.feature_pr(self.work_hour(day))

            if weekday and self.rng.random() < 0.18:
                # Dependabot runs on its own schedule, early morning
                self.dependabot_pr(day.replace(hour=self.rng.randint(4, 7), minute=self.rng.randint(0, 59)))

            for _ in range(self.rng.choices([0, 1, 2], weights=[45, 40, 15], k=1)[0]):
                if self.rng.random() < busy:
                    self.issue(self.work_hour(day))

            day += timedelta(days=1)

        self.member_added(self.working_time(self.join_time - timedelta(hours=2)), LATE_JOINER)

        # One emergency force push to main in the window, which the force-push alert would catch
        hotfix_day = self.start + (self.now - self.start) * self.rng.uniform(0.2, 0.9)
        hotfix_at = self.working_time(hotfix_day)
        sha = self.push(hotfix_at, MAINTAINERS[0], "main", "Hotfix: remove leaked config", forced=True)
        self.deploy_main(hotfix_at, sha, MAINTAINERS[0])

    def work_hour(self, day: datetime) -> datetime:
        hour = min(WORK_END_HOUR - 1, max(WORK_START_HOUR, int(self.rng.gauss(13, 2.2))))
        return day.replace(hour=hour, minute=self.rng.randint(0, 59), second=self.rng.randint(0, 59))


# ── Main ───────────────────────────────────────────────────────────────────────

def seeded_events_query(db, installation_id: int):
    return db.query(GitHubEvent).filter(
        GitHubEvent.installation_id == installation_id,
        GitHubEvent.delivery_id.like(f"{SEED_DELIVERY_PREFIX}%"),
    )


def ingest(db, events: list[tuple[datetime, str, dict]], installation_id: int) -> None:
    """Runs each payload through the real handler, then backdates it to when it 'happened'."""
    for i, (ts, event_type, payload) in enumerate(events, start=1):
        event_data = EVENT_HANDLERS[event_type](payload)
        saved = save_event(
            db=db,
            event_type=event_type,
            data=event_data,
            installation_id=installation_id,
            delivery_id=f"{SEED_DELIVERY_PREFIX}{uuid.uuid4()}",
        )
        saved.created_at = ts  # committed by the next save_event, or the final commit below
        if i % 250 == 0:
            print(f"  ...{i}/{len(events)}")
    db.commit()


def seed() -> None:
    installation_id = _args.installation_id or (settings.DEMO_INSTALLATION_IDS or [None])[0]
    if installation_id is None:
        sys.exit("No installation id: pass --installation-id or set DEMO_INSTALLATION_IDS.")

    rng = random.Random(_args.seed)
    now = datetime.now(UTC)
    start = now - timedelta(days=_args.days)

    sims = [RepoSim(repo, rng, installation_id, start, now) for repo in (_args.repos or DEFAULT_REPOS)]
    for sim in sims:
        sim.run()

    events = sorted((e for sim in sims for e in sim.events), key=lambda e: e[0])

    print(f"Generated {len(events)} events over {_args.days} days for installation {installation_id}:")
    for sim in sims:
        s = sim.stats
        print(
            f"  {sim.full_name}: {s['push']} pushes, {s['workflow_run']} workflow runs "
            f"({s['run_failure']} failed), {s['prs_merged']} PRs merged, {s['prs_abandoned']} closed unmerged, "
            f"{s['deploys']} deploys ({s['deploy_failures']} failed, {s['recoveries']} recovered), "
            f"{s['issues']} issue events ({s['issues_closed']} issues closed)"
        )

    if _args.dry_run:
        print("Dry run, nothing written.")
        return

    print(f"Target database: {os.environ['DATABASE_URL']}")
    db = SessionLocal()
    try:
        existing = seeded_events_query(db, installation_id).count()
        if existing and _args.reset:
            seeded_events_query(db, installation_id).delete(synchronize_session=False)
            db.commit()
            print(f"Removed {existing} previously seeded events.")
        elif existing and not _args.append:
            sys.exit(f"{existing} seeded events already exist for this installation. Use --reset or --append.")

        ingest(db, events, installation_id)
        print(f"Seeded {len(events)} events.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
