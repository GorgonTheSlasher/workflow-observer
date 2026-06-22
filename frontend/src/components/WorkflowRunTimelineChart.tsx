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
import type { WorkflowRunTimelineEntry } from "../api";

const SERIES = [
  { key: "success", label: "Success", color: "#00F6ED" },
  { key: "failure", label: "Failure", color: "#FFB800" },
  { key: "other",   label: "Other",   color: "#8A93A3" },
] as const;

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.1)",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
};

type SeriesKey = (typeof SERIES)[number]["key"];

type WorkflowRunTimelineChartProps = {
  data: WorkflowRunTimelineEntry[];
  isLoading?: boolean;
};

function formatXAxisDate(label: unknown): string {
  if (typeof label !== "string") return String(label ?? "");
  const [, month, day] = label.split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[Number(month) - 1]} ${Number(day)}`;
}

export default function WorkflowRunTimelineChart({
  data,
  isLoading = false,
}: WorkflowRunTimelineChartProps) {
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
        <div className="chart-card chart-card--loading">Loading workflow run timeline...</div>
      </section>
    );
  }

  const isEmpty = data.length === 0 || data.every((d) => d.success === 0 && d.failure === 0 && d.other === 0);

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header chart-card__header--row">
          <h2>Workflow Runs Over Time</h2>
          <p>Daily run outcomes. Click a legend item to show or hide it.</p>
        </div>

        {isEmpty ? (
          <p className="chart-empty">No workflow run data available.</p>
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
          </div>
        )}
      </article>
    </section>
  );
}
