import { useEffect, useState } from "react";
import { getWorkflowFailuresByBranch, type WorkflowFailuresByBranchEntry } from "../api";

type UseWorkflowFailuresByBranchResult = {
  workflowFailuresByBranch: WorkflowFailuresByBranchEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowFailuresByBranch(
  repoName: string,
  sinceDays?: number | null,
): UseWorkflowFailuresByBranchResult {
  const [workflowFailuresByBranch, setWorkflowFailuresByBranch] = useState<WorkflowFailuresByBranchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getWorkflowFailuresByBranch(repoName, sinceDays);
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
  }, [repoName, sinceDays]);

  return { workflowFailuresByBranch, isLoading, error };
}
