import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { topWithOther, truncateLabel, type RankedRow } from "../chartData";
import { CHART_THEME, SERIES_OTHER, tooltipStyle } from "../theme";

const MAX_ROWS = 8;
const LABEL_MAX_CHARS = 24;

type RankedFailuresChartProps = {
  title: string;
  noun: string;           // plural, for the "Other (n …)" row, e.g. "branches"
  rows: RankedRow[];
  isLoading?: boolean;
  onDrillDown?: (label: string) => void;
};

export default function RankedFailuresChart({
  title,
  noun,
  rows,
  isLoading = false,
  onDrillDown,
}: RankedFailuresChartProps) {
  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading workflow failures...</div>
      </section>
    );
  }

  const data = topWithOther(rows, MAX_ROWS, noun);
  const longestLabel = Math.max(0, ...data.map((d) => Math.min(d.label.length, LABEL_MAX_CHARS)));
  const yAxisWidth = Math.min(longestLabel * 7 + 16, 200);

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>{title}</h2>
        </div>

        {data.length === 0 ? (
          <p className="chart-empty">No workflow failures found.</p>
        ) : (
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  tickLine={{ stroke: CHART_THEME.grid }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={yAxisWidth}
                  interval={0}
                  tickFormatter={(label: string) => truncateLabel(label, LABEL_MAX_CHARS)}
                  tick={{ fill: CHART_THEME.text, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: CHART_THEME.cursor }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--text)" }}
                  formatter={(value) => [value, "Failures"]}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  onClick={onDrillDown ? (d) => {
                    const row = d as unknown as RankedRow;
                    if (!row.isOther) onDrillDown(row.label);
                  } : undefined}
                >
                  {data.map((row) => (
                    <Cell
                      key={row.label}
                      fill={row.isOther ? SERIES_OTHER : "var(--danger)"}
                      cursor={onDrillDown && !row.isOther ? "pointer" : undefined}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  );
}
