import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { FailureTrendEntry } from "../api";

type FailureTrendRadarProps = {
  data: FailureTrendEntry[];
  isLoading?: boolean;
};

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.15)",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
};

const LABEL_MAP: Record<string, string> = {
  success:   "Success",
  failure:   "Failure",
  cancelled: "Cancelled",
  skipped:   "Skipped",
};

export default function FailureTrendRadar({
  data,
  isLoading = false,
}: FailureTrendRadarProps) {
  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading failure trend...</div>
      </section>
    );
  }

  const displayData = data.map((d) => ({
    ...d,
    conclusion: LABEL_MAP[d.conclusion] ?? d.conclusion,
  }));

  const isEmpty = data.length === 0 || data.every((d) => d.current === 0 && d.prior === 0);

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Workflow Failure Trend</h2>
          <p>
            Conclusion breakdown by percentage — current 14 days vs prior 14 days.
          </p>
        </div>

        {isEmpty ? (
          <p className="chart-empty">No workflow run data available.</p>
        ) : (
          <div className="chart-body" style={{ minHeight: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={displayData} margin={{ top: 8, right: 32, left: 32, bottom: 8 }}>
                <PolarGrid stroke={CHART_THEME.grid} />
                <PolarAngleAxis
                  dataKey="conclusion"
                  tick={{ fill: CHART_THEME.text, fontSize: 13, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tickCount={5}
                  tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}%`]}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: CHART_THEME.text,
                  }}
                />
                <Legend wrapperStyle={{ color: CHART_THEME.text }} />
                <Radar
                  name="Prior 14 days"
                  dataKey="prior"
                  stroke="#6E7DAB"
                  fill="#6E7DAB"
                  fillOpacity={0.25}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                />
                <Radar
                  name="Current 14 days"
                  dataKey="current"
                  stroke="#5762D5"
                  fill="#5762D5"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  );
}
