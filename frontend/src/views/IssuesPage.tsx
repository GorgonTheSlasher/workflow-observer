import ErrorMessage from "../components/ErrorMessage";
import IssuesView from "../components/IssuesView";
import type { EventTypeFilter } from "../hooks/useEvents";
import { useIssues } from "../hooks/useIssues";
import type { DashboardScope, EventDrillDown } from "./filters";

type IssuesPageProps = {
  scope: DashboardScope;
  onDrillDown: (filters: EventDrillDown) => void;
};

export default function IssuesPage({ scope, onDrillDown }: IssuesPageProps) {
  const issues = useIssues(scope.repoName, scope.startDate, scope.endDate);

  return (
    <>
      <ErrorMessage error={issues.error} />
      <IssuesView
        stats={issues.stats}
        activity={issues.activity}
        labels={issues.labels}
        resolutionTrend={issues.resolutionTrend}
        reporters={issues.reporters}
        isLoading={issues.isLoading}
        onDrillDown={(f) => onDrillDown({
          eventType: f.event_type as EventTypeFilter | undefined,
          actor: f.actor,
        })}
      />
    </>
  );
}
