import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { GitHubEvent } from "../types";
import { parseUtcDate } from "../utils/time";
import { CONCLUSION_COLOR, badgeStyle } from "../theme";

type Props = {
  event: GitHubEvent | null;
  onClose: () => void;
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  workflow_run:  "Workflow Run",
  push:          "Push",
  pull_request:  "Pull Request",
  issues:        "Issue",
  member:        "Member",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - parseUtcDate(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(startIso: string, endIso: string): string {
  const secs = Math.max(0, Math.round((parseUtcDate(endIso).getTime() - parseUtcDate(startIso).getTime()) / 1000));
  if (secs < 60)  return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function get<T>(obj: Record<string, unknown> | null | undefined, ...keys: string[]): T | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur as T;
}

// ── Per-type content ──────────────────────────────────────────────────────────

function WorkflowRunDetail({ event }: { event: GitHubEvent }) {
  const wf = get<Record<string, unknown>>(event.details_json, "workflow_run");
  const startedAt  = get<string>(event.details_json, "workflow_run", "run_started_at");
  const updatedAt  = get<string>(event.details_json, "workflow_run", "updated_at");
  const duration   = startedAt && updatedAt ? formatDuration(startedAt, updatedAt) : null;
  const conclusion = event.conclusion ?? "";
  const color      = CONCLUSION_COLOR[conclusion] ?? "var(--text-muted)";

  return (
    <div className="edp-content">
      <div className="edp-row">
        <span className="edp-label">Workflow</span>
        <span className="edp-value edp-value--strong">
          {event.workflow_name ?? get<string>(wf, "name") ?? "—"}
        </span>
      </div>
      <div className="edp-row">
        <span className="edp-label">Conclusion</span>
        <span className="edp-badge" style={badgeStyle(color)}>
          {conclusion || "—"}
        </span>
      </div>
      {event.status && (
        <div className="edp-row">
          <span className="edp-label">Status</span>
          <span className="edp-value">{event.status}</span>
        </div>
      )}
      {event.branch && (
        <div className="edp-row">
          <span className="edp-label">Branch</span>
          <span className="edp-value edp-value--mono">{event.branch}</span>
        </div>
      )}
      {duration && (
        <div className="edp-row">
          <span className="edp-label">Duration</span>
          <span className="edp-value">{duration}</span>
        </div>
      )}
      {event.commit_sha && (
        <div className="edp-row">
          <span className="edp-label">Commit</span>
          <span className="edp-value edp-value--mono">{event.commit_sha.slice(0, 7)}</span>
        </div>
      )}
    </div>
  );
}

function PullRequestDetail({ event }: { event: GitHubEvent }) {
  const pr    = get<Record<string, unknown>>(event.details_json, "pull_request");
  const title = get<string>(pr, "title");
  const base  = get<string>(pr, "base", "label") ?? get<string>(pr, "base", "ref");
  const head  = get<string>(pr, "head", "label") ?? get<string>(pr, "head", "ref");
  const state = get<string>(pr, "state");
  const merged= get<boolean>(pr, "merged");

  return (
    <div className="edp-content">
      {title && (
        <div className="edp-row edp-row--column">
          <span className="edp-label">Title</span>
          <span className="edp-value edp-value--strong">{title}</span>
        </div>
      )}
      <div className="edp-row">
        <span className="edp-label">Action</span>
        <span className="edp-value">{event.action ?? "—"}</span>
      </div>
      {(base || head) && (
        <div className="edp-row">
          <span className="edp-label">Branches</span>
          <span className="edp-value edp-value--mono">
            {head ?? "?"} → {base ?? "?"}
          </span>
        </div>
      )}
      {state && (
        <div className="edp-row">
          <span className="edp-label">State</span>
          <span className="edp-value">{merged ? "merged" : state}</span>
        </div>
      )}
    </div>
  );
}

function PushDetail({ event }: { event: GitHubEvent }) {
  const headCommit = get<Record<string, unknown>>(event.details_json, "head_commit");
  const message    = get<string>(headCommit, "message")?.split("\n")[0];
  const commits    = get<unknown[]>(event.details_json, "commits");

  return (
    <div className="edp-content">
      {event.branch && (
        <div className="edp-row">
          <span className="edp-label">Branch</span>
          <span className="edp-value edp-value--mono">{event.branch}</span>
        </div>
      )}
      {event.commit_sha && (
        <div className="edp-row">
          <span className="edp-label">Head SHA</span>
          <span className="edp-value edp-value--mono">{event.commit_sha.slice(0, 7)}</span>
        </div>
      )}
      {commits != null && (
        <div className="edp-row">
          <span className="edp-label">Commits</span>
          <span className="edp-value">{commits.length}</span>
        </div>
      )}
      {message && (
        <div className="edp-row edp-row--column">
          <span className="edp-label">Message</span>
          <span className="edp-value edp-value--commit">{message}</span>
        </div>
      )}
    </div>
  );
}

function IssueDetail({ event }: { event: GitHubEvent }) {
  const issue = get<Record<string, unknown>>(event.details_json, "issue");
  const title = get<string>(issue, "title");
  const state = get<string>(issue, "state");
  const num   = get<number>(issue, "number");

  return (
    <div className="edp-content">
      {title && (
        <div className="edp-row edp-row--column">
          <span className="edp-label">Title</span>
          <span className="edp-value edp-value--strong">{title}</span>
        </div>
      )}
      {num != null && (
        <div className="edp-row">
          <span className="edp-label">Number</span>
          <span className="edp-value edp-value--mono">#{num}</span>
        </div>
      )}
      <div className="edp-row">
        <span className="edp-label">Action</span>
        <span className="edp-value">{event.action ?? "—"}</span>
      </div>
      {state && (
        <div className="edp-row">
          <span className="edp-label">State</span>
          <span className="edp-value">{state}</span>
        </div>
      )}
    </div>
  );
}

function MemberDetail({ event }: { event: GitHubEvent }) {
  const member   = get<Record<string, unknown>>(event.details_json, "member");
  const username = get<string>(member, "login");

  return (
    <div className="edp-content">
      <div className="edp-row">
        <span className="edp-label">Action</span>
        <span className="edp-value">{event.action ?? "—"}</span>
      </div>
      {username && (
        <div className="edp-row">
          <span className="edp-label">Member</span>
          <span className="edp-value edp-value--mono">{username}</span>
        </div>
      )}
    </div>
  );
}

function typeDetail(event: GitHubEvent) {
  switch (event.event_type) {
    case "workflow_run":  return <WorkflowRunDetail event={event} />;
    case "pull_request":  return <PullRequestDetail event={event} />;
    case "push":          return <PushDetail event={event} />;
    case "issues":        return <IssueDetail event={event} />;
    case "member":        return <MemberDetail event={event} />;
    default:              return null;
  }
}

// ── Raw payload ───────────────────────────────────────────────────────────────

function RawPayload({ data }: { data: Record<string, unknown> }) {
  return (
    <details className="edp-raw">
      <summary className="edp-raw__toggle">Raw payload</summary>
      <pre className="edp-raw__body">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function EventDetailPanel({ event, onClose }: Props) {
  useEffect(() => {
    if (!event) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [event, onClose]);

  if (!event) return null;

  const typeLabel = EVENT_TYPE_LABEL[event.event_type] ?? event.event_type;

  return createPortal(
    <div className="edp-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div className="edp-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="edp-header">
          <div className="edp-header__left">
            <span className="edp-type-badge">{typeLabel}</span>
            <span className="edp-repo">{event.repo_name}</span>
          </div>
          <button className="edp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Meta */}
        <div className="edp-meta">
          {event.actor && <span className="edp-meta__actor">{event.actor}</span>}
          <span className="edp-meta__time">{formatRelative(event.created_at)}</span>
        </div>

        <div className="edp-divider" />

        {/* Type-specific content */}
        {typeDetail(event)}

        {/* Footer */}
        <div className="edp-footer">
          {event.html_url && (
            <a
              className="edp-gh-link"
              href={event.html_url}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub ↗
            </a>
          )}
        </div>

        {/* Raw payload */}
        {event.details_json && <RawPayload data={event.details_json} />}

      </div>
    </div>,
    document.body
  );
}
