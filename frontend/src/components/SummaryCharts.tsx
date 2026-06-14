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

type SummaryChartsMode = "both" | "event-types" | "workflow-outcomes";

type SummaryChartsProps = {
  summary: Summary | null;
  workflowRunBreakdown: WorkflowRunBreakdown;
  isLoading?: boolean;
  mode?: SummaryChartsMode;
};

const CHART_THEME = {
  text:    "#D1E3DD",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
};

function formatTooltipValue(value: unknown, name: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return [numericValue.toLocaleString(), String(name)];
}

export default function SummaryCharts({
  summary,
  workflowRunBreakdown,
  isLoading = false,
  mode = "both",
}: SummaryChartsProps) {
  const showEventTypes = mode === "both" || mode === "event-types";
  const showWorkflowOutcomes = mode === "both" || mode === "workflow-outcomes";
  const isSingle = mode !== "both";

  if (isLoading) {
    return (
      <section className={isSingle ? "chart-section-single" : "charts-section"}>
        <div className="chart-card chart-card--loading">Loading charts...</div>
        {!isSingle && <div className="chart-card chart-card--loading">Loading charts...</div>}
      </section>
    );
  }

  if (!summary) {
    return (
      <section className={isSingle ? "chart-section-single" : "charts-section"}>
        <div className="chart-empty">No chart data available.</div>
      </section>
    );
  }

  const eventTypeData = [
    { name: "Pushes",         value: summary.total_pushes,           fill: "#5b9bd5" },
    { name: "Pull Requests",  value: summary.total_pull_requests ?? 0, fill: "#a78bfa" },
    { name: "Issues",         value: summary.total_issues,           fill: "#34d399" },
    { name: "Members",        value: summary.total_members,          fill: "#fbbf24" },
    { name: "Workflow Runs",  value: summary.total_workflows,        fill: "#e05c6a" },
  ].filter((item) => item.value > 0);

  const workflowData = [
    { name: "Success", value: workflowRunBreakdown.success, fill: "#34d399" },
    { name: "Failure", value: workflowRunBreakdown.failure, fill: "#e05c6a" },
  ].filter((item) => item.value > 0);

  return (
    <section className={isSingle ? "chart-section-single" : "charts-section"} aria-label="Activity charts">
      {showEventTypes && (
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
                  label={{ fill: CHART_THEME.text, fontSize: 12 }}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: CHART_THEME.text,
                  }}
                />
                <Legend wrapperStyle={{ color: CHART_THEME.text }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </article>
      )}

      {showWorkflowOutcomes && (
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
                  label={{ fill: CHART_THEME.text, fontSize: 12 }}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: CHART_THEME.text,
                  }}
                />
                <Legend wrapperStyle={{ color: CHART_THEME.text }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </article>
      )}
    </section>
  );
}
