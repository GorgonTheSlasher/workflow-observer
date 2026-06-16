import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TopActorEntry } from "../api";

type TopActorsChartProps = {
  data: TopActorEntry[];
  isLoading?: boolean;
};

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.1)",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
  bar:     "#00F6ED",
};

export default function TopActorsChart({
  data,
  isLoading = false,
}: TopActorsChartProps) {
  const yAxisWidth = data.length
    ? Math.min(Math.max(...data.map((d) => d.actor.length)) * 7 + 16, 220)
    : 100;
  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading top actors...</div>
      </section>
    );
  }

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Top Actors</h2>
        </div>

        {data.length === 0 ? (
          <p className="chart-empty">No actor data available.</p>
        ) : (
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  tickLine={{ stroke: CHART_THEME.grid }}
                />
                <YAxis
                  type="category"
                  dataKey="actor"
                  width={yAxisWidth}
                  tick={{ fill: CHART_THEME.text, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(209, 227, 221, 0.05)" }}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: CHART_THEME.text,
                  }}
                  formatter={(value) => [value, "Events"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_THEME.bar}
                      fillOpacity={1 - i * 0.12}
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
