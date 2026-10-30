import ErrorMessage from "../components/ErrorMessage";
import PrCycleTimeChart from "../components/PrCycleTimeChart";
import RecentActivityFeed from "../components/RecentActivityFeed";
import StatStrip from "../components/StatStrip";
import TimelineChart from "../components/TimelineChart";
import TopActorsChart from "../components/TopActorsChart";
import WorkflowHealthDonut from "../components/WorkflowHealthDonut";
import { usePrCycleTimes } from "../hooks/usePrCycleTimes";
import { useSummary } from "../hooks/useSummary";
import { useTimeline } from "../hooks/useTimeline";
import { useTopActors } from "../hooks/useTopActors";
import { useWorkflowRunBreakdown } from "../hooks/useWorkflowRunBreakdown";
import { firstError, type DashboardScope, type EventDrillDown } from "./filters";

type SummaryPageProps = {
  scope: DashboardScope;
  onDrillDown: (filters: EventDrillDown) => void;
};

export default function SummaryPage({ scope, onDrillDown }: SummaryPageProps) {
  const { repoName, startDate, endDate } = scope;

  const summary = useSummary();
  const topActors = useTopActors(repoName, startDate, endDate);
  const breakdown = useWorkflowRunBreakdown(repoName, startDate, endDate);
  const timeline = useTimeline(repoName, startDate, endDate);
  const prCycleTimes = usePrCycleTimes(repoName, startDate, endDate);

  const error = firstError(summary.error, topActors.error, breakdown.error, timeline.error, prCycleTimes.error);

  return (
    <>
      <ErrorMessage error={error} />
      <div className="summary-view">
        <StatStrip summary={summary.summary} isLoading={summary.isLoading} />
        <div className="summary-section">
          <div className="summary-section__left">
            <RecentActivityFeed />
          </div>
          <div className="summary-section__chart">
            <TopActorsChart
              data={topActors.topActors}
              isLoading={topActors.isLoading}
              onDrillDown={(actor) => onDrillDown({ actor })}
            />
          </div>
          <div className="summary-section__chart">
            <WorkflowHealthDonut
              workflowRunBreakdown={breakdown.workflowRunBreakdown}
              isLoading={breakdown.isLoading}
            />
          </div>
        </div>
        <div className="summary-charts-row">
          <TimelineChart data={timeline.timeline} isLoading={timeline.isLoading} />
          <PrCycleTimeChart data={prCycleTimes.prCycleTimes} isLoading={prCycleTimes.isLoading} />
        </div>
      </div>
    </>
  );
}
