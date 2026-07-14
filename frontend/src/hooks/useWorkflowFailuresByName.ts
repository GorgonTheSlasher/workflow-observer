import { useEffect, useState } from "react";
import { getWorkflowFailuresByName, type WorkflowFailuresByNameEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UseWorkflowFailuresByNameResult = {
  workflowFailuresByName: WorkflowFailuresByNameEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowFailuresByName(
  repoName: string,
  startDate?: string | null,
  endDate?: string | null,
): UseWorkflowFailuresByNameResult {
  const tick = useEventTick();
  const [workflowFailuresByName, setWorkflowFailuresByName] = useState<WorkflowFailuresByNameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getWorkflowFailuresByName(repoName, startDate, endDate);
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
  }, [repoName, startDate, endDate, tick]);

  return { workflowFailuresByName, isLoading, error };
}
