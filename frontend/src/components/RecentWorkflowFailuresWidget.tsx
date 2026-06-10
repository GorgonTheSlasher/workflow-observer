import type { GitHubEvent } from "../types";

type RecentWorkflowFailuresWidgetProps = {
  failures: GitHubEvent[];
  isLoading: boolean;
  limit?: number;
};

function formatWorkflowName(workflowName?: string | null) {
  return workflowName?.trim() || "Workflow";
}

function formatBranch(branch?: string | null) {
  if (!branch?.trim()) {
    return "Unknown";
  }

  return branch === "main" ? "Main" : branch;
}

function formatRelativeTime(dateText: string) {
  const failedAt = new Date(dateText).getTime();

  if (Number.isNaN(failedAt)) {
    return "unknown time ago";
  }

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - failedAt) / 1000));

  const units = [
    { label: "year", seconds: 60 * 60 * 24 * 365 },
    { label: "month", seconds: 60 * 60 * 24 * 30 },
    { label: "day", seconds: 60 * 60 * 24 },
    { label: "hour", seconds: 60 * 60 },
    { label: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const value = Math.floor(diffInSeconds / unit.seconds);

    if (value >= 1) {
      return `${value} ${unit.label}${value === 1 ? "" : "s"} ago`;
    }
  }

  return "just now";
}

export default function RecentWorkflowFailuresWidget({
  failures,
  isLoading,
  limit = 5,
}: RecentWorkflowFailuresWidgetProps) {
  const recentFailures = failures.slice(0, limit);

  return (
    <section className="failure-widget" aria-labelledby="failure-widget-heading">
      <div className="failure-widget__header">
        <div>
          <h2 id="failure-widget-heading">Recent Workflow Failures</h2>
          <p>Latest failed workflow runs for the selected repository.</p>
        </div>

        <span className="failure-widget__count" title="Total failed workflow runs">
          {failures.length}
        </span>
      </div>

      {isLoading ? (
        <p className="failure-widget__empty">Loading failed workflows...</p>
      ) : recentFailures.length === 0 ? (
        <p className="failure-widget__empty">No recent workflow failures found.</p>
      ) : (
        <ul className="failure-widget__list">
          {recentFailures.map((failure) => {
            const workflowName = formatWorkflowName(failure.workflow_name);
            const branch = formatBranch(failure.branch);
            const failedAgo = formatRelativeTime(failure.created_at);
            const conclusion = failure.conclusion ?? "failure";

            return (
              <li className="failure-widget__item" key={failure.id}>
                <span className="failure-widget__status" aria-hidden="true">
                  !
                </span>

                <div>
                  {failure.html_url ? (
                    <a
                      className="failure-widget__message"
                      href={failure.html_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {workflowName}
                    </a>
                  ) : (
                    <span className="failure-widget__message">{workflowName}</span>
                  )}

                  <span className="failure-widget__meta">
                    {branch} branch · {conclusion} · {failedAgo}
                  </span>

                  <span className="failure-widget__meta">
                    {failure.repo_name} · {failure.commit_sha?.slice(0, 7) ?? "No commit"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}