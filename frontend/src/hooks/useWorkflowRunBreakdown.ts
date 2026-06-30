import { useEffect, useState } from "react";
import { getWorkflowRuns } from "../api";
import { useEventTick } from "./useEventTick";

type WorkflowRunBreakdown = {
  success: number;
  failure: number;
  other: number;
};

type UseWorkflowRunBreakdownResult = {
  workflowRunBreakdown: WorkflowRunBreakdown;
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowRunBreakdown(
  repoName: string,
  sinceDays?: number | null,
): UseWorkflowRunBreakdownResult {
  const tick = useEventTick();
  const [workflowRunBreakdown, setWorkflowRunBreakdown] =
    useState<WorkflowRunBreakdown>({
      success: 0,
      failure: 0,
      other: 0,
    });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkflowRunBreakdown() {
      setIsLoading(true);
      setError(null);

      try {
        const [successSummary, failureSummary] = await Promise.all([
          getWorkflowRuns(repoName, "success", sinceDays),
          getWorkflowRuns(repoName, "failure", sinceDays),
        ]);

        if (!cancelled) {
          setWorkflowRunBreakdown({
            success: successSummary.count,
            failure: failureSummary.count,
            other: successSummary.total_workflows - successSummary.count - failureSummary.count,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWorkflowRunBreakdown();

    return () => {
      cancelled = true;
    };
  }, [repoName, sinceDays, tick]);

  return { workflowRunBreakdown, isLoading, error };
}
