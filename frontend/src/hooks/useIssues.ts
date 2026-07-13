import { useEffect, useState } from "react";
import {
  getIssueStats,
  getIssueActivity,
  getIssueLabels,
  getIssueResolutionTrend,
  getIssueReporters,
  type IssueStats,
  type IssueActivityEntry,
  type IssueLabelEntry,
  type IssueResolutionEntry,
  type TopActorEntry,
} from "../api";
import { useEventTick } from "./useEventTick";

type UseIssuesResult = {
  stats: IssueStats | null;
  activity: IssueActivityEntry[];
  labels: IssueLabelEntry[];
  resolutionTrend: IssueResolutionEntry[];
  reporters: TopActorEntry[];
  isLoading: boolean;
  error: string | null;
};

export function useIssues(repoName: string, sinceDays?: number | null): UseIssuesResult {
  const tick = useEventTick();
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [activity, setActivity] = useState<IssueActivityEntry[]>([]);
  const [labels, setLabels] = useState<IssueLabelEntry[]>([]);
  const [resolutionTrend, setResolutionTrend] = useState<IssueResolutionEntry[]>([]);
  const [reporters, setReporters] = useState<TopActorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [s, a, l, r, rep] = await Promise.all([
          getIssueStats(repoName, sinceDays),
          getIssueActivity(repoName, sinceDays),
          getIssueLabels(repoName, sinceDays),
          getIssueResolutionTrend(repoName, sinceDays),
          getIssueReporters(repoName, sinceDays),
        ]);
        if (!cancelled) {
          setStats(s);
          setActivity(a);
          setLabels(l);
          setResolutionTrend(r);
          setReporters(rep);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [repoName, sinceDays, tick]);

  return { stats, activity, labels, resolutionTrend, reporters, isLoading, error };
}
