import ErrorMessage from "../components/ErrorMessage";
import RecentWorkflowFailuresWidget from "../components/RecentWorkflowFailuresWidget";
import WorkflowExecutionTimeChart from "../components/WorkflowExecutionTimeChart";
import WorkflowFailuresByBranchChart from "../components/WorkflowFailuresByBranchChart";
import WorkflowFailuresByNameChart from "../components/WorkflowFailuresByNameChart";
import WorkflowRunTimelineChart from "../components/WorkflowRunTimelineChart";
import { useFailedWorkflowRuns } from "../hooks/useFailedWorkflowRuns";
import { useWorkflowExecutionTime } from "../hooks/useWorkflowExecutionTime";
import { useWorkflowFailuresByBranch } from "../hooks/useWorkflowFailuresByBranch";
import { useWorkflowFailuresByName } from "../hooks/useWorkflowFailuresByName";
import { useWorkflowRunTimeline } from "../hooks/useWorkflowRunTimeline";
import { firstError, type DashboardScope, type EventDrillDown } from "./filters";

type WorkflowsPageProps = {
  scope: DashboardScope;
  onDrillDown: (filters: EventDrillDown) => void;
};

export default function WorkflowsPage({ scope, onDrillDown }: WorkflowsPageProps) {
  const { repoName, startDate, endDate } = scope;

  const byBranch = useWorkflowFailuresByBranch(repoName, startDate, endDate);
  const byName = useWorkflowFailuresByName(repoName, startDate, endDate);
  const executionTimes = useWorkflowExecutionTime(repoName, startDate, endDate);
  const runTimeline = useWorkflowRunTimeline(repoName, startDate, endDate);
  const failures = useFailedWorkflowRuns(repoName);

  const error = firstError(byBranch.error, byName.error, executionTimes.error, runTimeline.error, failures.error);

  return (
    <>
      <ErrorMessage error={error} />
      <div className="workflows-view">
        <div className="workflows-charts-row">
          <WorkflowFailuresByBranchChart
            data={byBranch.workflowFailuresByBranch}
            isLoading={byBranch.isLoading}
            onDrillDown={(branch) => onDrillDown({ eventType: "workflow_run", conclusion: "failure", branch })}
          />
          <WorkflowFailuresByNameChart
            data={byName.workflowFailuresByName}
            isLoading={byName.isLoading}
            onDrillDown={(workflowName) => onDrillDown({ eventType: "workflow_run", conclusion: "failure", workflowName })}
          />
          <WorkflowExecutionTimeChart
            data={executionTimes.executionTimes}
            isLoading={executionTimes.isLoading}
          />
        </div>
        <div className="workflows-bottom-row">
          <WorkflowRunTimelineChart
            data={runTimeline.workflowRunTimeline}
            isLoading={runTimeline.isLoading}
          />
          <RecentWorkflowFailuresWidget
            failures={failures.failedWorkflows}
            limit={4}
            isLoading={failures.isLoading}
          />
        </div>
      </div>
    </>
  );
}
