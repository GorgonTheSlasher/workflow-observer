import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Rectangle,
  type BarShapeProps,
} from "recharts";
import type { WorkflowFailuresByNameEntry } from "../api";

type WorkflowFailuresByNameChartProps = {
  data: WorkflowFailuresByNameEntry[];
  isLoading?: boolean;
  onDrillDown?: (workflowName: string) => void;
};

const CHART_THEME = {
  text:    "#D1E3DD",
  grid:    "rgba(209, 227, 221, 0.1)",
  tooltip: { background: "#32292F", border: "rgba(209, 227, 221, 0.15)" },
  bar:     "#FFB800",
};

export default function WorkflowFailuresByNameChart({
  data,
  isLoading = false,
  onDrillDown,
}: WorkflowFailuresByNameChartProps) {
  const yAxisWidth = data.length
    ? Math.min(Math.max(...data.map((d) => d.workflow_name.length)) * 7 + 16, 220)
    : 100;

  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading workflow failures...</div>
      </section>
    );
  }

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Failures by Workflow</h2>
        </div>

        {data.length === 0 ? (
          <p className="chart-empty">No workflow failures found.</p>
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
                  dataKey="workflow_name"
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
                  formatter={(value) => [value, "Failures"]}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  fill={CHART_THEME.bar}
                  style={onDrillDown ? { cursor: "pointer" } : undefined}
                  onClick={onDrillDown ? (d) => onDrillDown((d as unknown as { workflow_name: string }).workflow_name) : undefined}
                  shape={(props: BarShapeProps) => (
                    <Rectangle {...props} fillOpacity={1 - props.index * 0.15} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  );
}
