import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Rectangle,
  type BarShapeProps,
} from "recharts";
import type {
  IssueStats,
  IssueActivityEntry,
  IssueLabelEntry,
  IssueResolutionEntry,
  TopActorEntry,
} from "../api";
import { CHART_THEME, SERIES, tooltipStyle } from "../theme";

type IssuesViewProps = {
  stats: IssueStats | null;
  activity: IssueActivityEntry[];
  labels: IssueLabelEntry[];
  resolutionTrend: IssueResolutionEntry[];
  reporters: TopActorEntry[];
  isLoading: boolean;
  onDrillDown?: (filters: { event_type?: string; actor?: string }) => void;
};

const COLOR = {
  opened:     SERIES[0],
  closed:     SERIES[1],
  label:      SERIES[0],
  resolution: SERIES[0],
  reporter:   SERIES[0],
};

function formatXAxis(label: unknown): string {
  if (typeof label !== "string") return String(label ?? "");
  const [, month, day] = label.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(month) - 1]} ${Number(day)}`;
}

function formatHours(h: number): string {
  if (h < 1)  return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function IssueTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="issue-tile">
      <p className="issue-tile__label">{label}</p>
      <p className="issue-tile__value">{value}</p>
      {sub && <p className="issue-tile__sub">{sub}</p>}
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header chart-card__header--row">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="chart-body">{children}</div>
      </article>
    </section>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function IssuesView({
  stats,
  activity,
  labels,
  resolutionTrend,
  reporters,
  isLoading,
  onDrillDown,
}: IssuesViewProps) {
  if (isLoading || !stats) {
    return (
      <div className="issues-view">
        <div className="issues-tiles">
          {["Opened", "Closed", "Close Rate", "Avg Time to Close"].map((n) => (
            <div key={n} className="issue-tile issue-tile--loading">{n}</div>
          ))}
        </div>
      </div>
    );
  }

  const avgCloseDisplay = stats.avg_close_time != null
    ? formatHours(stats.avg_close_time)
    : "—";

  const labelYAxisWidth = labels.length
    ? Math.min(Math.max(...labels.map((l) => l.label.length)) * 7 + 16, 200)
    : 80;

  const reporterYAxisWidth = reporters.length
    ? Math.min(Math.max(...reporters.map((r) => r.actor.length)) * 7 + 16, 200)
    : 80;

  return (
    <div className="issues-view">

      {/* KPI tiles */}
      <div className="issues-tiles">
        <IssueTile label="Opened" value={String(stats.opened)} sub="issues opened" />
        <IssueTile label="Closed" value={String(stats.closed)} sub="issues closed" />
        <IssueTile
          label="Close Rate"
          value={stats.close_rate != null ? `${stats.close_rate}%` : "—"}
          sub="closed / opened"
        />
        <IssueTile
          label="Avg Time to Close"
          value={avgCloseDisplay}
          sub={stats.avg_close_time != null ? "average" : "no data"}
        />
      </div>

      {/* Charts */}
      <div className="issues-charts">

        {/* Activity over time */}
        <ChartCard title="Issue Activity" subtitle="Opened vs. closed per day">
          {activity.length === 0 ? (
            <p className="chart-empty">No issue activity in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: "var(--text)" }} />
                <Legend wrapperStyle={{ fontSize: "0.75rem", color: CHART_THEME.text }} />
                <Area type="monotone" dataKey="opened" name="Opened" stroke={COLOR.opened} fill={COLOR.opened} fillOpacity={0.15} strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="closed" name="Closed" stroke={COLOR.closed} fill={COLOR.closed} fillOpacity={0.15} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* By label */}
        <ChartCard title="Issues by Label" subtitle="Label frequency on opened issues">
          {labels.length === 0 ? (
            <p className="chart-empty">No labels found on issues in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labels} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_THEME.text, fontSize: 11 }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <YAxis type="category" dataKey="label" width={labelYAxisWidth} tick={{ fill: CHART_THEME.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: CHART_THEME.cursor }} contentStyle={tooltipStyle} formatter={(v) => [v, "Issues"]} />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  shape={(props: BarShapeProps) => (
                    <Rectangle {...props} fill={COLOR.label} fillOpacity={1 - props.index * 0.08} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top reporters */}
        <ChartCard title="Top Reporters" subtitle="Who's opening the most issues">
          {reporters.length === 0 ? (
            <p className="chart-empty">No issue reporters found.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reporters} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_THEME.text, fontSize: 11 }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <YAxis type="category" dataKey="actor" width={reporterYAxisWidth} tick={{ fill: CHART_THEME.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: CHART_THEME.cursor }} contentStyle={tooltipStyle} formatter={(v) => [v, "Issues opened"]} />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  style={onDrillDown ? { cursor: "pointer" } : undefined}
                  onClick={onDrillDown ? (d) => onDrillDown({ event_type: "issues", actor: (d as unknown as { actor: string }).actor }) : undefined}
                  shape={(props: BarShapeProps) => (
                    <Rectangle {...props} fill={COLOR.reporter} fillOpacity={1 - props.index * 0.1} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Resolution trend */}
        <ChartCard title="Resolution Time" subtitle="Avg hours from open to close, by day">
          {resolutionTrend.length === 0 ? (
            <p className="chart-empty">No closed issues with paired open events found.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resolutionTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={formatHours} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: "var(--text)" }} formatter={(v) => [formatHours(Number(v)), "Avg close time"]} />
                <Area type="monotone" dataKey="avg_hours" name="Avg close time" stroke={COLOR.resolution} fill={COLOR.resolution} fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>
    </div>
  );
}
