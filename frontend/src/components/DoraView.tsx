import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DoraMetrics, DoraRating } from "../api";
import { CHART_THEME, SERIES, badgeStyle, tooltipStyle } from "../theme";

type DoraViewProps = {
  data: DoraMetrics | null;
  isLoading: boolean;
};

const RATING_COLOR: Record<DoraRating, string> = {
  elite:  "var(--success)",
  high:   "var(--info)",
  medium: "var(--warning)",
  low:    "var(--danger)",
};

const RATING_LABEL: Record<DoraRating, string> = {
  elite:  "Elite",
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

function formatXAxis(label: unknown): string {
  if (typeof label !== "string") return String(label ?? "");
  const [, month, day] = label.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(month) - 1]} ${Number(day)}`;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// ── DORA tile ─────────────────────────────────────────────────────────────────

type TileProps = {
  name: string;
  description: string;
  value: number | null;
  unit: string;
  displayValue: string;
  rating: DoraRating;
  bands: string;
  direction: "higher" | "lower";
};

function DoraTile({ name, description, displayValue, unit, rating, bands, direction }: TileProps) {
  const color = RATING_COLOR[rating];
  return (
    <div className="dora-tile">
      <div className="dora-tile__header">
        <span className="dora-tile__name">{name}</span>
        <span
          className="dora-tile__badge"
          style={badgeStyle(color)}
        >
          {RATING_LABEL[rating]}
        </span>
      </div>
      <div className="dora-tile__value-row">
        <span className="dora-tile__value">
          {displayValue}
        </span>
        {unit && <span className="dora-tile__unit">{unit}</span>}
      </div>
      <p className="dora-tile__description">{description}</p>
      <p className="dora-tile__bands">{bands}</p>
      <p className="dora-tile__direction">
        {direction === "higher" ? "↑ Higher is better" : "↓ Lower is better"}
      </p>
    </div>
  );
}

// ── Chart wrapper ─────────────────────────────────────────────────────────────

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

export default function DoraView({ data, isLoading }: DoraViewProps) {
  if (isLoading || !data) {
    return (
      <div className="dora-view">
        <div className="dora-tiles">
          {["Deploy Frequency", "Change Failure Rate", "Mean Time to Recovery", "Lead Time for Changes"].map((n) => (
            <div key={n} className="dora-tile dora-tile--loading">{n}</div>
          ))}
        </div>
      </div>
    );
  }

  const { deploy_frequency: df, change_failure_rate: cfr, mttr, lead_time: lt } = data;

  const deploySource = df.fallback
    ? "No deploy workflow found for some repos, so all successful main/master runs are counted"
    : df.workflows.length > 0
      ? `Counting successful runs of ${df.workflows.join(", ")} on main/master`
      : "Successful deploy workflow runs on main/master";

  const tiles: TileProps[] = [
    {
      name: "Deploy Frequency",
      description: `Deployments per day. ${deploySource}.`,
      value: df.value,
      displayValue: df.value != null ? (df.value < 1 ? df.value.toFixed(2) : df.value.toFixed(1)) : "—",
      unit: "/ day",
      rating: df.rating,
      bands: "Elite ≥1/day · High ≥1/wk · Medium ≥1/mo",
      direction: "higher",
    },
    {
      name: "Change Failure Rate",
      description: "% of deployments that failed",
      value: cfr.value,
      displayValue: cfr.value != null ? `${cfr.value.toFixed(1)}%` : "—",
      unit: "",
      rating: cfr.rating,
      bands: "Elite ≤5% · High ≤10% · Medium ≤15%",
      direction: "lower",
    },
    {
      name: "Mean Time to Recovery",
      description: "Avg time from a failed deployment to the next successful one",
      value: mttr.value,
      displayValue: mttr.value != null ? formatHours(mttr.value) : "—",
      unit: mttr.value != null ? "avg" : "",
      rating: mttr.rating,
      bands: "Elite <1h · High <1d · Medium <1wk",
      direction: "lower",
    },
    {
      name: "Lead Time for Changes",
      description: "Avg time from a change's first commit to its successful deployment",
      value: lt.value,
      displayValue: lt.value != null ? formatHours(lt.value) : "—",
      unit: lt.value != null ? "avg" : "",
      rating: lt.rating,
      bands: "Elite <1h · High <1d · Medium <1wk",
      direction: "lower",
    },
  ];

  return (
    <div className="dora-view">
      <div className="dora-tiles">
        {tiles.map((t) => <DoraTile key={t.name} {...t} />)}
      </div>

      <div className="dora-charts">
        {/* Deploy Frequency */}
        <ChartCard title="Deploy Frequency" subtitle={`${deploySource}, by day`}>
          {df.trend.length === 0 ? (
            <p className="chart-empty">No deployment data on main/master.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={df.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: "var(--text)" }} formatter={(v) => [v, "Deployments"]} />
                <Bar dataKey="value" name="Deployments" fill={SERIES[0]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Change Failure Rate */}
        <ChartCard title="Change Failure Rate" subtitle="% of deployments that failed, by day">
          {cfr.trend.length === 0 ? (
            <p className="chart-empty">No deployments on main/master yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cfr.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} domain={[0, 100]} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: "var(--text)" }} formatter={(v) => [`${v}%`, "Failure rate"]} />
                <Area type="monotone" dataKey="value" name="Failure rate" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* MTTR */}
        <ChartCard title="Mean Time to Recovery" subtitle="Hours from a failed deployment to the next successful one">
          {mttr.trend.length === 0 ? (
            <p className="chart-empty">No failed deployments in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mttr.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={formatHours} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: "var(--text)" }} formatter={(v) => [formatHours(Number(v)), "Avg recovery time"]} />
                <Area type="monotone" dataKey="value" name="Avg recovery time" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Lead Time */}
        <ChartCard title="Lead Time for Changes" subtitle="Hours from first commit to successful deployment, by day">
          {lt.trend.length === 0 ? (
            <p className="chart-empty">No deployments could be traced back to a push or merged PR.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lt.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={formatHours} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: "var(--text)" }} formatter={(v) => [formatHours(Number(v)), "Avg lead time"]} />
                <Area type="monotone" dataKey="value" name="Avg lead time" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
