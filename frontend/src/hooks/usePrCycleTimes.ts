import { useEffect, useState } from "react";
import { getPrCycleTimes, type PrCycleTimeEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UsePrCycleTimesResult = {
  prCycleTimes: PrCycleTimeEntry[];
  isLoading: boolean;
  error: string | null;
};

export function usePrCycleTimes(
  repoName: string,
  startDate?: string | null,
  endDate?: string | null,
): UsePrCycleTimesResult {
  const tick = useEventTick();
  const [prCycleTimes, setPrCycleTimes] = useState<PrCycleTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getPrCycleTimes(repoName, startDate, endDate);
        if (!cancelled) setPrCycleTimes(data);
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

  return { prCycleTimes, isLoading, error };
}
