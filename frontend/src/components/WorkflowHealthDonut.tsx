import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type WorkflowHealthDonutProps = {
  workflowRunBreakdown: { success: number; failure: number; other: number };
  isLoading?: boolean;
};

const CHART_THEME = {
  text:    "#8A95A5",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
};

export default function WorkflowHealthDonut({
  workflowRunBreakdown,
  isLoading = false,
}: WorkflowHealthDonutProps) {
  const { success, failure, other } = workflowRunBreakdown;
  const completed = success + failure;
  const total = completed + other;
  const successRate = completed > 0 ? Math.round((success / completed) * 100) : null;

  const barData = [{ success, failure, other }];

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
          <div className="health-bar-wrapper">
            {successRate !== null && (
              <div className="health-bar__rate">
                <span className="health-bar__rate-value">{successRate}%</span>
                <span className="health-bar__rate-label">Success Rate</span>
              </div>
            )}

            <div className="health-bar__chart-wrapper">
              <ResponsiveContainer width="100%" height={44}>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  barSize={44}
                >
                  <XAxis type="number" domain={[0, total]} hide />
                  <YAxis type="category" hide />
                  <Tooltip
                    contentStyle={{
                      background: CHART_THEME.tooltip.background,
                      border: `1px solid ${CHART_THEME.tooltip.border}`,
                      borderRadius: 8,
                      color: CHART_THEME.text,
                    }}
                    cursor={false}
                    formatter={(value, name) => [
                      `${value} (${Math.round((Number(value) / total) * 100)}%)`,
                      name,
                    ]}
                  />
                  <Bar dataKey="success" stackId="a" fill="#00F6ED" name="Success" />
                  <Bar dataKey="failure" stackId="a" fill="#FFB800" name="Failure" />
                  <Bar dataKey="other" stackId="a" fill="#8A93A3" name="Other" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="health-bar__legend">
              <span className="health-bar__legend-item">
                <span className="health-bar__legend-swatch" style={{ background: "#00F6ED" }} />
                Success ({success})
              </span>
              <span className="health-bar__legend-item">
                <span className="health-bar__legend-swatch" style={{ background: "#FFB800" }} />
                Failure ({failure})
              </span>
              <span className="health-bar__legend-item">
                <span className="health-bar__legend-swatch" style={{ background: "#8A93A3" }} />
                Other ({other})
              </span>
            </div>

            <div className="health-bar__total">
              <span className="health-bar__total-value">{total.toLocaleString()}</span>
              <span className="health-bar__total-label">Total Runs</span>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
