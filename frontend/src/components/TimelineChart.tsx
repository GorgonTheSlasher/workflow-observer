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
  { key: "workflow_run", label: "Workflow Runs", color: "#cf222e" },
  { key: "push",         label: "Pushes",        color: "#0969da" },
  { key: "pull_request", label: "Pull Requests",  color: "#8250df" },
  { key: "issues",       label: "Issues",         color: "#1a7f37" },
  { key: "member",       label: "Members",        color: "#bf8700" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

type TimelineChartProps = {
  data: TimelineEntry[];
  isLoading?: boolean;
};

function formatXAxisDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
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
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxisDate}
                tick={{ fontSize: 12 }}
                minTickGap={50}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={formatXAxisDate} />
              <Legend
                onClick={(e) => toggleSeries(e.dataKey as SeriesKey)}
                formatter={(value, entry) => (
                  <span style={{ opacity: hidden.has(entry.dataKey as SeriesKey) ? 0.35 : 1 }}>
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
                  fillOpacity={0.6}
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
