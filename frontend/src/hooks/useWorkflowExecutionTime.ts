import { useEffect, useState } from "react";
import { getWorkflowExecutionTimes, type WorkflowExecutionTimeEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UseWorkflowExecutionTimeResult = {
  executionTimes: WorkflowExecutionTimeEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkflowExecutionTime(
  repoName: string,
  sinceDays?: number | null,
): UseWorkflowExecutionTimeResult {
  const tick = useEventTick();
  const [executionTimes, setExecutionTimes] = useState<WorkflowExecutionTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getWorkflowExecutionTimes(repoName, sinceDays);
        if (!cancelled) setExecutionTimes(data);
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
  }, [repoName, sinceDays, tick]);

  return { executionTimes, isLoading, error };
}
