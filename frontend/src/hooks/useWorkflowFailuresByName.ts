import { useEffect, useState } from "react";
import { getWorkflowFailuresByName, type WorkflowFailuresByNameEntry } from "../api";

type UseWorkflowFailuresByNameResult = {
  workflowFailuresByName: WorkflowFailuresByNameEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowFailuresByName(
  repoName: string,
  sinceDays?: number | null,
): UseWorkflowFailuresByNameResult {
  const [workflowFailuresByName, setWorkflowFailuresByName] = useState<WorkflowFailuresByNameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getWorkflowFailuresByName(repoName, sinceDays);
        if (!cancelled) setWorkflowFailuresByName(data);
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

  return { workflowFailuresByName, isLoading, error };
}
