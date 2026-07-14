import { useEffect, useState } from "react";
import { getEventTypeBreakdown, type EventTypeBreakdownEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UseEventTypeBreakdownResult = {
  eventTypeBreakdown: EventTypeBreakdownEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useEventTypeBreakdown(
  repoName: string,
  eventType: string,
  actor: string,
  startDate?: string | null,
  endDate?: string | null,
): UseEventTypeBreakdownResult {
  const tick = useEventTick();
  const [eventTypeBreakdown, setEventTypeBreakdown] = useState<EventTypeBreakdownEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getEventTypeBreakdown(repoName, eventType, actor, startDate, endDate);
        if (!cancelled) setEventTypeBreakdown(data);
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
  }, [repoName, eventType, actor, startDate, endDate, tick]);

  return { eventTypeBreakdown, isLoading, error };
}
