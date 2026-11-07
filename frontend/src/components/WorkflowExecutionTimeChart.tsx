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
import type { WorkflowExecutionTimeEntry } from "../api";
import { formatMinutes } from "../chartData";
import { CHART_THEME, SERIES } from "../theme";

type WorkflowExecutionTimeChartProps = {
  data: WorkflowExecutionTimeEntry[];
  isLoading?: boolean;
};

export default function WorkflowExecutionTimeChart({
  data,
  isLoading = false,
}: WorkflowExecutionTimeChartProps) {
  const yAxisWidth = data.length
    ? Math.min(Math.max(...data.map((d) => d.workflow_name.length)) * 7 + 16, 220)
    : 100;

  if (isLoading) {
    return (
      <section>
        <div className="chart-card chart-card--loading">Loading execution times...</div>
      </section>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    avg_minutes: d.avg_seconds / 60,
  }));

  return (
    <section>
      <article className="chart-card">
        <div className="chart-card__header">
          <h2>Avg Execution Time</h2>
        </div>

        {chartData.length === 0 ? (
          <p className="chart-empty">No execution time data available.</p>
        ) : (
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={formatMinutes}
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
                  cursor={{ fill: CHART_THEME.cursor }}
                  contentStyle={{
                    background: CHART_THEME.tooltip.background,
                    border: `1px solid ${CHART_THEME.tooltip.border}`,
                    borderRadius: 8,
                    color: "var(--text)",
                  }}
                  formatter={(value, _name, props) => [
                    `${formatMinutes(Number(value))} (${props.payload.run_count} runs)`,
                    "Avg duration",
                  ]}
                />
                <Bar
                  dataKey="avg_minutes"
                  radius={[0, 4, 4, 0]}
                  fill={SERIES[0]}
                  shape={(props: BarShapeProps) => (
                    <Rectangle {...props} />
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
