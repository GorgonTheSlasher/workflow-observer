import type { WorkflowFailuresByNameEntry } from "../api";
import RankedFailuresChart from "./RankedFailuresChart";

type WorkflowFailuresByNameChartProps = {
  data: WorkflowFailuresByNameEntry[];
  isLoading?: boolean;
  onDrillDown?: (workflowName: string) => void;
};

export default function WorkflowFailuresByNameChart({ data, isLoading, onDrillDown }: WorkflowFailuresByNameChartProps) {
  return (
    <RankedFailuresChart
      title="Failures by Workflow"
      noun="workflows"
      rows={data.map((d) => ({ label: d.workflow_name, count: d.count }))}
      isLoading={isLoading}
      onDrillDown={onDrillDown}
    />
  );
}
