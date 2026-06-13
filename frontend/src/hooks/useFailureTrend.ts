import { useEffect, useState } from "react";
import { getFailureTrend, type FailureTrendEntry } from "../api";

type UseFailureTrendResult = {
  failureTrend: FailureTrendEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useFailureTrend(repoName: string): UseFailureTrendResult {
  const [failureTrend, setFailureTrend] = useState<FailureTrendEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoName) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getFailureTrend(repoName);
        if (!cancelled) setFailureTrend(data);
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
  }, [repoName]);

  return { failureTrend, isLoading, error };
}
