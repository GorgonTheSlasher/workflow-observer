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

type DoraViewProps = {
  data: DoraMetrics | null;
  isLoading: boolean;
};

const RATING_COLOR: Record<DoraRating, string> = {
  elite:  "#00F6ED",
  high:   "#22c55e",
  medium: "#FFB800",
  low:    "#ef4444",
};

const RATING_LABEL: Record<DoraRating, string> = {
  elite:  "Elite",
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.1)",
  tooltip: { bg: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
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

const tooltipStyle = {
  background: CHART_THEME.tooltip.bg,
  border: `1px solid ${CHART_THEME.tooltip.border}`,
  borderRadius: 8,
  color: CHART_THEME.text,
};

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
          style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
        >
          {RATING_LABEL[rating]}
        </span>
      </div>
      <div className="dora-tile__value-row">
        <span className="dora-tile__value" style={{ color }}>
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

  const tiles: TileProps[] = [
    {
      name: "Deploy Frequency",
      description: "Successful deployments to main/master per day",
      value: df.value,
      displayValue: df.value != null ? (df.value < 1 ? df.value.toFixed(2) : df.value.toFixed(1)) : "—",
      unit: "/ day",
      rating: df.rating,
      bands: "Elite ≥1/day · High ≥1/wk · Medium ≥1/mo",
      direction: "higher",
    },
    {
      name: "Change Failure Rate",
      description: "% of workflow runs ending in failure",
      value: cfr.value,
      displayValue: cfr.value != null ? `${cfr.value.toFixed(1)}%` : "—",
      unit: "",
      rating: cfr.rating,
      bands: "Elite ≤5% · High ≤10% · Medium ≤15%",
      direction: "lower",
    },
    {
      name: "Mean Time to Recovery",
      description: "Avg time from workflow failure to next success on the same branch",
      value: mttr.value,
      displayValue: mttr.value != null ? formatHours(mttr.value) : "—",
      unit: mttr.value != null ? "avg" : "",
      rating: mttr.rating,
      bands: "Elite <1h · High <1d · Medium <1wk",
      direction: "lower",
    },
    {
      name: "Lead Time for Changes",
      description: "Avg time from push to successful deployment on main/master",
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
        <ChartCard title="Deploy Frequency" subtitle="Successful deployments to main/master, by day">
          {df.trend.length === 0 ? (
            <p className="chart-empty">No deployment data on main/master.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={df.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: CHART_THEME.text }} formatter={(v) => [v, "Deployments"]} />
                <Bar dataKey="value" name="Deployments" fill="#00F6ED" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Change Failure Rate */}
        <ChartCard title="Change Failure Rate" subtitle="% of workflow runs ending in failure, by day">
          {cfr.trend.length === 0 ? (
            <p className="chart-empty">No completed workflow run data.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cfr.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} domain={[0, 100]} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: CHART_THEME.text }} formatter={(v) => [`${v}%`, "Failure rate"]} />
                <Area type="monotone" dataKey="value" name="Failure rate" stroke="#FFB800" fill="#FFB800" fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* MTTR */}
        <ChartCard title="Mean Time to Recovery" subtitle="Hours from failure to next success, per incident">
          {mttr.trend.length === 0 ? (
            <p className="chart-empty">No failure-to-recovery sequences found yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mttr.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={formatHours} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: CHART_THEME.text }} formatter={(v) => [formatHours(Number(v)), "Avg recovery time"]} />
                <Area type="monotone" dataKey="value" name="Avg recovery time" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Lead Time */}
        <ChartCard title="Lead Time for Changes" subtitle="Hours from push to successful deployment, by day">
          {lt.trend.length === 0 ? (
            <p className="chart-empty">No push-to-deploy pairs found. Push and workflow SHAs must match.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lt.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} minTickGap={50} />
                <YAxis tickFormatter={formatHours} tick={{ fontSize: 12, fill: CHART_THEME.text }} axisLine={{ stroke: CHART_THEME.grid }} tickLine={{ stroke: CHART_THEME.grid }} />
                <Tooltip labelFormatter={formatXAxis} contentStyle={tooltipStyle} labelStyle={{ color: CHART_THEME.text }} formatter={(v) => [formatHours(Number(v)), "Avg lead time"]} />
                <Area type="monotone" dataKey="value" name="Avg lead time" stroke="#818cf8" fill="#818cf8" fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
