import { useEffect, useState } from "react";
import { getFailedWorkflowRuns } from "../api";
import type { GitHubEvent } from "../types";

type UseFailedWorkflowRunsResult = {
  failedWorkflows: GitHubEvent[];
  isLoading: boolean;
  error: string | null;
};

export function useFailedWorkflowRuns(repoName: string): UseFailedWorkflowRunsResult {
  const [failedWorkflows, setFailedWorkflows] = useState<GitHubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFailedWorkflowRuns() {
      if (!repoName) {
        setFailedWorkflows([]);
        setIsLoading(false);
        return;
      }

      try {
        const data = await getFailedWorkflowRuns(repoName);

        if (!cancelled) {
          setFailedWorkflows(data);
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

    loadFailedWorkflowRuns();

    return () => {
      cancelled = true;
    };
  }, [repoName]);

  return { failedWorkflows, isLoading, error };
}
