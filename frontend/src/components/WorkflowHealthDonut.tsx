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
    { name: "Success", value: success, fill: "#00F6ED" },
    { name: "Failure", value: failure, fill: "#FFB800" },
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
        </div>

        {total === 0 ? (
          <p className="chart-empty">No workflow run data available.</p>
        ) : (
          <div className="donut-wrapper">
            <div className="donut-chart-area" style={{ minHeight: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="52%"
                    outerRadius="78%"
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
                    formatter={(value, name) => [
                      `${value} (${Math.round((Number(value) / total) * 100)}%)`,
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
            </div>

            <div className="donut-legend">
              <span className="donut-legend__item">
                <span className="donut-legend__swatch" style={{ background: "#00F6ED" }} />
                Success ({success})
              </span>
              <span className="donut-legend__item">
                <span className="donut-legend__swatch" style={{ background: "#FFB800" }} />
                Failure ({failure})
              </span>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
