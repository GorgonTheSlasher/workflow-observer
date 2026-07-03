import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PrCycleTimeEntry } from "../api";

type PrCycleTimeChartProps = {
  data: PrCycleTimeEntry[];
  isLoading?: boolean;
};

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.1)",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
  line:    "#a78bfa",
};

function formatXAxisDate(label: unknown): string {
  if (typeof label !== "string") return String(label ?? "");
  const [, month, day] = label.split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[Number(month) - 1]} ${Number(day)}`;
}

function formatHours(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function PrCycleTimeChart({
  data,
  isLoading = false,
}: PrCycleTimeChartProps) {
  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading PR cycle times...</div>
      </section>
    );
  }

  const isEmpty = data.length === 0;

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header chart-card__header--row">
          <h2>PR Cycle Time</h2>
          <p>Avg hours from open to close, by day.</p>
        </div>

        {isEmpty ? (
          <p className="chart-empty">No PR cycle time data available.</p>
        ) : (
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXAxisDate}
                  tick={{ fontSize: 12, fill: CHART_THEME.text }}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  tickLine={{ stroke: CHART_THEME.grid }}
                  minTickGap={50}
                />
                <YAxis
                  tickFormatter={formatHours}
                  tick={{ fontSize: 12, fill: CHART_THEME.text }}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  tickLine={{ stroke: CHART_THEME.grid }}
                />
                <Tooltip
                  labelFormatter={formatXAxisDate}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: CHART_THEME.text,
                  }}
                  labelStyle={{ color: CHART_THEME.text }}
                  formatter={(value, _name, props) => [
                    `${formatHours(Number(value))} (${props.payload.count} PR${props.payload.count !== 1 ? "s" : ""})`,
                    "Avg cycle time",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="avg_hours"
                  name="Avg cycle time"
                  stroke={CHART_THEME.line}
                  fill={CHART_THEME.line}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  );
}
