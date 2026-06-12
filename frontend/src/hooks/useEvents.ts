import { useEffect, useState } from "react";
import { getEvents, type EventFilters } from "../api";
import type { GitHubEvent } from "../types";

export type EventTypeFilter =
  | ""
  | "push"
  | "pull_request"
  | "workflow_run"
  | "issues"
  | "member";

export type ConclusionFilter =
  | ""
  | "success"
  | "failure"
  | "cancelled"
  | "skipped";

type UseEventsResult = {
  events: GitHubEvent[];
  total: number;
  isLoading: boolean;
  error: string | null;
};

export function useEvents(filters: EventFilters = {}): UseEventsResult {
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getEvents(filters);

        if (!cancelled) {
          setEvents(data.events);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return { events, total, isLoading, error };
}
