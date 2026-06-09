import { useEffect, useState } from "react";
import { getRepositories } from "../api";

type UseRepositoriesResult = {
  repositories: string[];
  isLoading: boolean;
  error: string | null;
};

export function useRepositories(): UseRepositoriesResult {
  const [repositories, setRepositories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRepositories() {
      try {
        const data = await getRepositories();

        if (!cancelled) {
          setRepositories(data);
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

    loadRepositories();

    return () => {
      cancelled = true;
    };
  }, []);

  return { repositories, isLoading, error };
}
