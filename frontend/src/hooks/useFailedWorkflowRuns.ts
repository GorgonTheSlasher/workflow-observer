import { useEffect, useState } from "react";
import { getFailedWorkflowRuns } from "../api";
import { useEventTick } from "../context/EventStreamContext";
import type { GitHubEvent } from "../types";

type UseFailedWorkflowRunsResult = {
  failedWorkflows: GitHubEvent[];
  isLoading: boolean;
  error: string | null;
};

export function useFailedWorkflowRuns(repoName: string): UseFailedWorkflowRunsResult {
  const tick = useEventTick();
  const [failedWorkflows, setFailedWorkflows] = useState<GitHubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFailedWorkflowRuns() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getFailedWorkflowRuns(repoName);

        if (!cancelled) {
          setFailedWorkflows(data);
        }
      } catch (err) {
        if (!cancelled) {
          setFailedWorkflows([]);
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFailedWorkflowRuns();

    return () => {
      cancelled = true;
    };
  }, [repoName, tick]);

  return { failedWorkflows, isLoading, error };
}
