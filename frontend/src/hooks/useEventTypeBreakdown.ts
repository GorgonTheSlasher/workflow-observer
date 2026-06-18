import { useEffect, useState } from "react";
import { getEventTypeBreakdown, type EventTypeBreakdownEntry } from "../api";

type UseEventTypeBreakdownResult = {
  eventTypeBreakdown: EventTypeBreakdownEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useEventTypeBreakdown(
  repoName: string,
  eventType: string,
  actor: string,
  sinceDays?: number | null,
): UseEventTypeBreakdownResult {
  const [eventTypeBreakdown, setEventTypeBreakdown] = useState<EventTypeBreakdownEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getEventTypeBreakdown(repoName, eventType, actor, sinceDays);
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
  }, [repoName, eventType, actor, sinceDays]);

  return { eventTypeBreakdown, isLoading, error };
}
