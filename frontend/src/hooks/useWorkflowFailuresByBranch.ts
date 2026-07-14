import { useEffect, useState } from "react";
import { getWorkflowFailuresByBranch, type WorkflowFailuresByBranchEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UseWorkflowFailuresByBranchResult = {
  workflowFailuresByBranch: WorkflowFailuresByBranchEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowFailuresByBranch(
  repoName: string,
  startDate?: string | null,
  endDate?: string | null,
): UseWorkflowFailuresByBranchResult {
  const tick = useEventTick();
  const [workflowFailuresByBranch, setWorkflowFailuresByBranch] = useState<WorkflowFailuresByBranchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getWorkflowFailuresByBranch(repoName, startDate, endDate);
        if (!cancelled) setWorkflowFailuresByBranch(data);
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
  }, [repoName, startDate, endDate, tick]);

  return { workflowFailuresByBranch, isLoading, error };
}
