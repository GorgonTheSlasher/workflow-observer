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
      <div className="summary-grid" aria-label="Loading summary statistics">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="summary-card summary-card--loading" key={index}>
            <span className="summary-card__label">Loading</span>
            <span className="summary-card__value">—</span>
          </div>
        ))}
      </div>
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
    { label: "Total Events",   value: summary.total_events,         variant: "primary"  },
    { label: "Repositories",   value: summary.total_repositories,   variant: "default"  },
    { label: "Actors",         value: summary.total_unique_actors,  variant: "default"  },
    { label: "Workflow Runs",  value: summary.total_workflows,      variant: "workflow" },
    { label: "Pull Requests",  value: summary.total_pull_requests,  variant: "default"  },
    { label: "Pushes",         value: summary.total_pushes,         variant: "default"  },
    { label: "Issues",         value: summary.total_issues,         variant: "default"  },
    { label: "Members",        value: summary.total_members,        variant: "default"  },
  ];

  return (
    <div className="summary-grid" aria-label="Summary statistics">
      {cards.map((card) => (
        <article
          className={`summary-card summary-card--${card.variant}`}
          key={card.label}
        >
          <span className="summary-card__label">{card.label}</span>
          <span className="summary-card__value">
            {formatNumber(card.value)}
          </span>
        </article>
      ))}
    </div>
  );
}