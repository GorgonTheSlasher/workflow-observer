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
import { CHART_THEME, EVENT_TYPE_COLOR } from "../theme";

const SERIES = [
  { key: "workflow_run", label: "Workflow Runs", color: EVENT_TYPE_COLOR.workflow_run },
  { key: "push",         label: "Pushes",        color: EVENT_TYPE_COLOR.push },
  { key: "pull_request", label: "Pull Requests",  color: EVENT_TYPE_COLOR.pull_request },
  { key: "issues",       label: "Issues",         color: EVENT_TYPE_COLOR.issues },
  { key: "member",       label: "Members",        color: EVENT_TYPE_COLOR.member },
] as const;

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
        <div className="chart-card__header chart-card__header--row" style={{ marginLeft: "3.5rem" }}>
          <h2>Event Timeline</h2>
          <p>Activity over time by event type. Click a legend item to show or hide it.</p>
        </div>

        {data.length === 0 ? (
          <p className="chart-empty">No timeline data available.</p>
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
                    color: "var(--text)",
                  }}
                  labelStyle={{ color: "var(--text)" }}
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
