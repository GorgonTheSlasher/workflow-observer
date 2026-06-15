import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimelineEntry } from "../api";

const SERIES = [
  { key: "workflow_run", label: "Workflow Runs", color: "#e05c6a" },
  { key: "push",         label: "Pushes",        color: "#5b9bd5" },
  { key: "pull_request", label: "Pull Requests",  color: "#a78bfa" },
  { key: "issues",       label: "Issues",         color: "#34d399" },
  { key: "member",       label: "Members",        color: "#fbbf24" },
] as const;

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.1)",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
};

type SeriesKey = (typeof SERIES)[number]["key"];

type TimelineChartProps = {
  data: TimelineEntry[];
  isLoading?: boolean;
};

function formatXAxisDate(label: unknown): string {
  if (typeof label !== "string") return String(label ?? "");
  const [, month, day] = label.split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[Number(month) - 1]} ${Number(day)}`;
}

export default function TimelineChart({
  data,
  isLoading = false,
}: TimelineChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());

  function toggleSeries(key: SeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading timeline...</div>
      </section>
    );
  }

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Event Timeline</h2>
          <p>Activity over time by event type. Click a legend item to show or hide it.</p>
        </div>

        {data.length === 0 ? (
          <p className="chart-empty">No timeline data available.</p>
        ) : (
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
                allowDecimals={false}
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
              />
              <Legend
                onClick={(e) => toggleSeries(e.dataKey as SeriesKey)}
                wrapperStyle={{ color: CHART_THEME.text }}
                formatter={(value, entry) => (
                  <span style={{ opacity: hidden.has(entry.dataKey as SeriesKey) ? 0.35 : 1, color: CHART_THEME.text }}>
                    {value}
                  </span>
                )}
              />
              {SERIES.map(({ key, label, color }) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stackId="a"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.55}
                  hide={hidden.has(key)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </article>
    </section>
  );
}
