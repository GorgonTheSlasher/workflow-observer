import { useEffect, useState } from "react";
import { getRecentEvents } from "../api";
import type { GitHubEvent } from "../types";

export function useRecentEvents(limit = 10) {
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getRecentEvents(limit)
      .then((data) => { if (!cancelled) setEvents(data); })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [limit]);

  return { events, isLoading, error };
}
