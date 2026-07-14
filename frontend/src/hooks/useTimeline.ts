import { useEffect, useState } from "react";
import { getTimeline, type TimelineEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UseTimelineResult = {
  timeline: TimelineEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useTimeline(
  repoName: string,
  startDate: string | null,
  endDate: string | null,
): UseTimelineResult {
  const tick = useEventTick();
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getTimeline(repoName, startDate, endDate);
        if (!cancelled) setTimeline(data);
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

  return { timeline, isLoading, error };
}
