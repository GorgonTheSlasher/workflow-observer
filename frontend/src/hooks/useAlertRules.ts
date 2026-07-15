import { useState, useEffect } from "react";
import {
  type AlertRule,
  type AlertRuleCreate,
  getAlertRules,
  createAlertRule,
  toggleAlertRule,
  deleteAlertRule,
} from "../api";

export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAlertRules();
        if (!cancelled) setRules(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addRule(data: AlertRuleCreate): Promise<void> {
    const rule = await createAlertRule(data);
    setRules((prev) => [rule, ...prev]);
  }

  async function toggleRule(id: number): Promise<void> {
    const updated = await toggleAlertRule(id);
    setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function removeRule(id: number): Promise<void> {
    await deleteAlertRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return { rules, isLoading, error, addRule, toggleRule, removeRule };
}
