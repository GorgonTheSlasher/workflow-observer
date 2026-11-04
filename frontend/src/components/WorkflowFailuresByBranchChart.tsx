import type { WorkflowFailuresByBranchEntry } from "../api";
import RankedFailuresChart from "./RankedFailuresChart";

type WorkflowFailuresByBranchChartProps = {
  data: WorkflowFailuresByBranchEntry[];
  isLoading?: boolean;
  onDrillDown?: (branch: string) => void;
};

export default function WorkflowFailuresByBranchChart({ data, isLoading, onDrillDown }: WorkflowFailuresByBranchChartProps) {
  return (
    <RankedFailuresChart
      title="Failures by Branch"
      noun="branches"
      rows={data.map((d) => ({ label: d.branch, count: d.count }))}
      isLoading={isLoading}
      onDrillDown={onDrillDown}
    />
  );
}
