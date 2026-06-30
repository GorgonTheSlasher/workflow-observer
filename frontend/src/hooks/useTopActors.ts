import { useEffect, useState } from "react";
import { getTopActors, type TopActorEntry } from "../api";
import { useEventTick } from "./useEventTick";

type UseTopActorsResult = {
  topActors: TopActorEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useTopActors(
  repoName: string,
  sinceDays?: number | null,
  eventType?: string,
  actor?: string,
): UseTopActorsResult {
  const tick = useEventTick();
  const [topActors, setTopActors] = useState<TopActorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getTopActors(repoName, 5, sinceDays, eventType, actor);
        if (!cancelled) setTopActors(data);
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
  }, [repoName, sinceDays, eventType, actor, tick]);

  return { topActors, isLoading, error };
}
