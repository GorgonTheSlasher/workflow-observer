// Chart colors as CSS variable references, so charts follow the tokens in index.css.
// Recharts passes these straight to SVG fill/stroke, where var() works.

export const CHART_THEME = {
  text: "var(--text-muted)",
  grid: "var(--chart-grid)",
  cursor: "var(--overlay-hover)",
  tooltip: { background: "var(--surface-2)", border: "var(--border-strong)" },
};

export const tooltipStyle = {
  background: CHART_THEME.tooltip.background,
  border: `1px solid ${CHART_THEME.tooltip.border}`,
  borderRadius: 8,
  color: "var(--text)",
  boxShadow: "var(--shadow-md)",
};

export const tooltipLabelStyle = { color: "var(--text)" };
export const tooltipItemStyle = { color: "var(--text-secondary)" };

export const axisTick = { fontSize: 12, fill: CHART_THEME.text };

// Categorical slots, in the validated order. A chart with one series uses SERIES[0].
export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
] as const;

export const SERIES_OTHER = "var(--series-other)";

// Each event type keeps its color on every chart and in the activity feed
export const EVENT_TYPE_COLOR: Record<string, string> = {
  workflow_run: SERIES[0],
  push: SERIES[1],
  pull_request: SERIES[2],
  issues: SERIES[3],
  member: SERIES[4],
};

// Run outcomes are states, so they use status colors rather than series slots
export const RUN_OUTCOME_COLOR = {
  success: "var(--success)",
  failure: "var(--danger)",
  other: SERIES_OTHER,
};

export const CONCLUSION_COLOR: Record<string, string> = {
  success: "var(--success)",
  failure: "var(--danger)",
  timed_out: "var(--warning)",
  cancelled: "var(--text-muted)",
  skipped: "var(--text-muted)",
  neutral: "var(--text-muted)",
};

// Tinted badge (background, text and border) from one color, without hex-alpha suffixes
export function badgeStyle(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    color,
    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
  };
}
