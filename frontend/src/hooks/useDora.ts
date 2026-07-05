import { useEffect, useState } from "react";
import { getDora, type DoraMetrics } from "../api";
import { useEventTick } from "./useEventTick";

type UseDoraResult = {
  dora: DoraMetrics | null;
  isLoading: boolean;
  error: string | null;
};

export function useDora(repoName: string, sinceDays?: number | null): UseDoraResult {
  const tick = useEventTick();
  const [dora, setDora] = useState<DoraMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getDora(repoName, sinceDays);
        if (!cancelled) setDora(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [repoName, sinceDays, tick]);

  return { dora, isLoading, error };
}
