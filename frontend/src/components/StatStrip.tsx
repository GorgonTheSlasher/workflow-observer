import type { Summary } from "../api";

type StatStripProps = {
  summary: Summary | null;
  isLoading?: boolean;
};

const STATS = [
  { label: "Total Events",   key: "total_events"          },
  { label: "Repositories",   key: "total_repositories"    },
  { label: "Actors",         key: "total_unique_actors"   },
  { label: "Workflow Runs",  key: "total_workflows"       },
  { label: "Pull Requests",  key: "total_pull_requests"   },
  { label: "Pushes",         key: "total_pushes"          },
  { label: "Issues",         key: "total_issues"          },
  { label: "Members",        key: "total_members"         },
] as const;

type StatKey = (typeof STATS)[number]["key"];

export default function StatStrip({ summary, isLoading = false }: StatStripProps) {
  return (
    <div className="stat-strip">
      {STATS.map(({ label, key }) => {
        const value = summary ? (summary[key as StatKey] ?? 0) : 0;
        return (
          <div className="stat-strip__item" key={key}>
            <span className="stat-strip__label">{label}</span>
            <span className={`stat-strip__value${isLoading ? " stat-strip__value--loading" : ""}`}>
              {isLoading ? "—" : (value as number).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
