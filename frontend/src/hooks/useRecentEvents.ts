import { useEffect, useState } from "react";
import { getRecentEvents } from "../api";
import { useEventTick } from "./useEventTick";
import type { GitHubEvent } from "../types";

export function useRecentEvents(limit = 10) {
  const tick = useEventTick();
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getRecentEvents(limit);
        if (!cancelled) setEvents(data);
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
  }, [limit, tick]);

  return { events, isLoading, error };
}
