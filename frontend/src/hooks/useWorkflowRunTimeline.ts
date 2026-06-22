import { useEffect, useState } from "react";
import { getWorkflowRunTimeline, type WorkflowRunTimelineEntry } from "../api";

type UseWorkflowRunTimelineResult = {
  workflowRunTimeline: WorkflowRunTimelineEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowRunTimeline(
  repoName: string,
  sinceDays?: number | null,
): UseWorkflowRunTimelineResult {
  const [workflowRunTimeline, setWorkflowRunTimeline] = useState<WorkflowRunTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getWorkflowRunTimeline(repoName, sinceDays);
        if (!cancelled) setWorkflowRunTimeline(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [repoName, sinceDays]);

  return { workflowRunTimeline, isLoading, error };
}
