import { useEffect, useState } from "react";
import { getEvents } from "../api";
import type { GitHubEvent } from "../types";

export type EventTypeFilter =
  | ""
  | "push"
  | "pull_request"
  | "workflow_run"
  | "issues"
  | "member";

type UseEventsResult = {
  events: GitHubEvent[];
  isLoading: boolean;
  error: string | null;
};

export function useEvents(eventType: EventTypeFilter): UseEventsResult {
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setError(null);

      try {
        const data = await getEvents({ event_type: eventType });

        if (!cancelled) {
          setEvents(data);
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
  }, [eventType]);

  return { events, isLoading, error };
}
