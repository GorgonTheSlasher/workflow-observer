import type { Summary } from "../api";

type SummaryCardsProps = {
  summary: Summary | null;
  isLoading?: boolean;
};

function formatNumber(value: number | undefined): string {
  return (value ?? 0).toLocaleString();
}

export default function SummaryCards({
  summary,
  isLoading = false,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <section className="summary-grid" aria-label="Loading summary statistics">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="summary-card summary-card--loading" key={index}>
            <span className="summary-card__label">Loading</span>
            <span className="summary-card__value">—</span>
          </div>
        ))}
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="summary-empty">
        <p>No summary data available.</p>
      </section>
    );
  }

  const cards = [
    {
      label: "Total Events",
      value: summary.total_events,
      helper: "All webhook events stored",
      variant: "primary",
    },
    {
      label: "Repositories",
      value: summary.total_repositories,
      helper: "Unique repositories observed",
      variant: "default",
    },
    {
      label: "Actors",
      value: summary.total_unique_actors,
      helper: "Unique users, apps, and bots",
      variant: "default",
    },
    {
      label: "Workflow Runs",
      value: summary.total_workflows,
      helper: "GitHub Actions runs",
      variant: "workflow",
    },
    {
      label: "Pull Requests",
      value: summary.total_pull_requests,
      helper: "Pull request webhook events",
      variant: "default",
    },
    {
      label: "Pushes",
      value: summary.total_pushes,
      helper: "Push webhook events",
      variant: "default",
    },
    {
      label: "Issues",
      value: summary.total_issues,
      helper: "Issue webhook events",
      variant: "default",
    },
    {
      label: "Members",
      value: summary.total_members,
      helper: "Member webhook events",
      variant: "default",
    },
  ];

  return (
    <section className="summary-section" aria-labelledby="summary-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="summary-heading">Project Summary</h2>
          <p className="section-subtitle">
            High-level activity captured from GitHub webhooks.
          </p>
        </div>
      </div>

      <div className="summary-grid">
        {cards.map((card) => (
          <article
            className={`summary-card summary-card--${card.variant}`}
            key={card.label}
          >
            <span className="summary-card__label">{card.label}</span>
            <span className="summary-card__value">
              {formatNumber(card.value)}
            </span>
            <span className="summary-card__helper">{card.helper}</span>
          </article>
        ))}
      </div>
    </section>
  );
}