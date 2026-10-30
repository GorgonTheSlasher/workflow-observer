import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_THEME, RUN_OUTCOME_COLOR } from "../theme";

type WorkflowHealthDonutProps = {
  workflowRunBreakdown: { success: number; failure: number; other: number };
  isLoading?: boolean;
};

type BarPayloadEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | [number, number];
  fill?: string;
};

function BarTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: BarPayloadEntry[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: CHART_THEME.tooltip.background,
      border: `1px solid ${CHART_THEME.tooltip.border}`,
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: "0.8rem",
      color: "var(--text)",
      pointerEvents: "none",
    }}>
      {payload.map((entry) => {
        const raw = entry.value;
        const val = Array.isArray(raw) ? raw[1] - raw[0] : Number(raw ?? 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return (
          <div key={String(entry.dataKey)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: entry.fill ?? "", flexShrink: 0, display: "inline-block" }} />
            <span>{entry.name}: {val} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

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
            <div className="health-bar__stats">
              {successRate !== null && (
                <div className="health-bar__stat">
                  <span className="health-bar__stat-value">{successRate}%</span>
                  <span className="health-bar__stat-label">Success Rate</span>
                </div>
              )}
              <div className="health-bar__stat">
                <span className="health-bar__stat-value">{total.toLocaleString()}</span>
                <span className="health-bar__stat-label">Total Runs</span>
              </div>
            </div>

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
                    cursor={false}
                    content={({ active, payload }) => (
                      <BarTooltip
                        active={active}
                        payload={payload as unknown as BarPayloadEntry[] | undefined}
                        total={total}
                      />
                    )}
                  />
                  <Bar dataKey="success" stackId="a" fill={RUN_OUTCOME_COLOR.success} name="Success" />
                  <Bar dataKey="failure" stackId="a" fill={RUN_OUTCOME_COLOR.failure} name="Failure" />
                  <Bar dataKey="other" stackId="a" fill={RUN_OUTCOME_COLOR.other} name="Other" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="health-bar__legend">
              <span className="health-bar__legend-item">
                <span className="health-bar__legend-swatch" style={{ background: RUN_OUTCOME_COLOR.success }} />
                Success ({success})
              </span>
              <span className="health-bar__legend-item">
                <span className="health-bar__legend-swatch" style={{ background: RUN_OUTCOME_COLOR.failure }} />
                Failure ({failure})
              </span>
              <span className="health-bar__legend-item">
                <span className="health-bar__legend-swatch" style={{ background: RUN_OUTCOME_COLOR.other }} />
                Other ({other})
                <span className="health-bar__info-anchor">
                  ?
                  <span className="health-bar__info-tooltip">
                    Runs with a conclusion other than success or failure — includes cancelled, skipped, timed out, neutral, and action required.
                  </span>
                </span>
              </span>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
