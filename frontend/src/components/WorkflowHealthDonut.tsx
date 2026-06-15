import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type WorkflowHealthDonutProps = {
  workflowRunBreakdown: { success: number; failure: number };
  isLoading?: boolean;
};

const CHART_THEME = {
  text:    "#D1E3DD",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
};

export default function WorkflowHealthDonut({
  workflowRunBreakdown,
  isLoading = false,
}: WorkflowHealthDonutProps) {
  const { success, failure } = workflowRunBreakdown;
  const total = success + failure;
  const successRate = total > 0 ? Math.round((success / total) * 100) : null;

  const pieData = [
    { name: "Success", value: success, fill: "#34d399" },
    { name: "Failure", value: failure, fill: "#e05c6a" },
  ].filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading workflow health...</div>
      </section>
    );
  }

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Workflow Health</h2>
          <p>Overall success rate across all workflow runs.</p>
        </div>

        {total === 0 ? (
          <p className="chart-empty">No workflow run data available.</p>
        ) : (
          <div className="donut-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={85}
                  outerRadius={120}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                />
                <Tooltip
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: CHART_THEME.text,
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} (${Math.round((value / total) * 100)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            {successRate !== null && (
              <div className="donut-center" aria-label={`${successRate}% success rate`}>
                <span className="donut-center__rate">{successRate}%</span>
                <span className="donut-center__label">Success Rate</span>
              </div>
            )}

            <div className="donut-legend">
              <span className="donut-legend__item">
                <span className="donut-legend__swatch" style={{ background: "#34d399" }} />
                Success ({success})
              </span>
              <span className="donut-legend__item">
                <span className="donut-legend__swatch" style={{ background: "#e05c6a" }} />
                Failure ({failure})
              </span>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
