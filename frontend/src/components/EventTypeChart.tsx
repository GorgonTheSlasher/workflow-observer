import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Rectangle,
  type BarShapeProps,
} from "recharts";
import type { EventTypeBreakdownEntry } from "../api";
import { CHART_THEME, EVENT_TYPE_COLOR, SERIES_OTHER } from "../theme";

type EventTypeChartProps = {
  data: EventTypeBreakdownEntry[];
  isLoading?: boolean;
  onDrillDown?: (eventType: string) => void;
};

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

export default function EventTypeChart({
  data,
  isLoading = false,
  onDrillDown,
}: EventTypeChartProps) {
  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading events by type...</div>
      </section>
    );
  }

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Events by Type</h2>
        </div>

        {data.length === 0 ? (
          <p className="chart-empty">No event data available.</p>
        ) : (
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis
                  dataKey="event_type"
                  tickFormatter={formatType}
                  tick={{ fill: CHART_THEME.text, fontSize: 12 }}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  tickLine={{ stroke: CHART_THEME.grid }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART_THEME.text, fontSize: 12 }}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  tickLine={{ stroke: CHART_THEME.grid }}
                />
                <Tooltip
                  cursor={{ fill: CHART_THEME.cursor }}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: "var(--text)",
                  }}
                  formatter={(value) => [value, "Events"]}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  style={onDrillDown ? { cursor: "pointer" } : undefined}
                  onClick={onDrillDown ? (d) => onDrillDown((d as unknown as { event_type: string }).event_type) : undefined}
                  shape={(props: BarShapeProps) => {
                    const eventType = props.payload?.event_type as string | undefined;
                    return (
                      <Rectangle {...props} fill={EVENT_TYPE_COLOR[eventType ?? ""] ?? SERIES_OTHER} />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  );
}
