import {
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Summary } from "../api";

type WorkflowRunBreakdown = {
  success: number;
  failure: number;
};

type SummaryChartsProps = {
  summary: Summary | null;
  workflowRunBreakdown: WorkflowRunBreakdown;
  isLoading?: boolean;
};

function formatTooltipValue(value: unknown, name: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return [numericValue.toLocaleString(), String(name)];
}

export default function SummaryCharts({
  summary,
  workflowRunBreakdown,
  isLoading = false,
}: SummaryChartsProps) {
  if (isLoading) {
    return (
      <section className="charts-section">
        <div className="chart-card chart-card--loading">Loading charts...</div>
        <div className="chart-card chart-card--loading">Loading charts...</div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="charts-section">
        <div className="chart-empty">No chart data available.</div>
      </section>
    );
  }

  const eventTypeData = [
    { name: "Pushes", value: summary.total_pushes, fill: "#0969da" },
    {
      name: "Pull Requests",
      value: summary.total_pull_requests ?? 0,
      fill: "#8250df",
    },
    { name: "Issues", value: summary.total_issues, fill: "#1a7f37" },
    { name: "Members", value: summary.total_members, fill: "#bf8700" },
    {
      name: "Workflow Runs",
      value: summary.total_workflows,
      fill: "#cf222e",
    },
  ].filter((item) => item.value > 0);

  const workflowData = [
    { name: "Success", value: workflowRunBreakdown.success, fill: "#1a7f37" },
    { name: "Failure", value: workflowRunBreakdown.failure, fill: "#cf222e" },
  ].filter((item) => item.value > 0);

  return (
    <section className="charts-section" aria-label="Activity charts">
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Events by Type</h2>
          <p>Distribution of stored GitHub webhook event types.</p>
        </div>

        {eventTypeData.length === 0 ? (
          <p className="chart-empty">No event data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={eventTypeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                label
              />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </article>

      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Workflow Outcomes</h2>
          <p>Successful vs failed workflow runs for the selected repository.</p>
        </div>

        {workflowData.length === 0 ? (
          <p className="chart-empty">No workflow outcome data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={workflowData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                label
              />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </article>
    </section>
  );
}
