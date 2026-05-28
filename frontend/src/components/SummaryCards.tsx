import type { GitHubEvent } from "../types";

type SummaryCardsProps = {
  events: GitHubEvent[];
};

export default function SummaryCards({ events }: SummaryCardsProps) {
  const totalEvents = events.length;

  const failedWorkflows = events.filter(
    (event) =>
      event.event_type === "workflow_run" &&
      event.conclusion === "failure"
  ).length;

  const successfulWorkflows = events.filter(
    (event) =>
      event.event_type === "workflow_run" &&
      event.conclusion === "success"
  ).length;

  const uniqueRepos = new Set(events.map((event) => event.repo_name)).size;

  return (
    <section className="summary-grid">
      <div className="card">
        <h3>Total Events</h3>
        <p>{totalEvents}</p>
      </div>

      <div className="card">
        <h3>Failed Workflows</h3>
        <p>{failedWorkflows}</p>
      </div>

      <div className="card">
        <h3>Successful Workflows</h3>
        <p>{successfulWorkflows}</p>
      </div>

      <div className="card">
        <h3>Repositories</h3>
        <p>{uniqueRepos}</p>
      </div>
    </section>
  );
}