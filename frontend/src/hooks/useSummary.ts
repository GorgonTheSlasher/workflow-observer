import { useEffect, useState } from "react";
import { getSummary, type Summary } from "../api";

type UseSummaryResult = {
  summary: Summary | null;
  isLoading: boolean;
  error: string | null;
};

export function useSummary(): UseSummaryResult {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const data = await getSummary();

        if (!cancelled) {
          setSummary(data);
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

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, isLoading, error };
}
