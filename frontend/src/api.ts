import type { GitHubEvent } from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

export async function getRecentEvents(limit = 10): Promise<GitHubEvent[]> {
  const response = await fetch(`${API_BASE_URL}/events/recent?limit=${limit}`);

  if (!response.ok) {
    throw new Error("Failed to fetch recent events");
  }

  return response.json();
}

export async function getFailedWorkflowRuns(): Promise<GitHubEvent[]> {
  const response = await fetch(`${API_BASE_URL}/events/workflow-runs/failures`);

  if (!response.ok) {
    throw new Error("Failed to fetch failed workflows");
  }

  return response.json();
}

export type EventFilters = {
  event_type?: string;
  repo_name?: string;
  actor?: string;
  conclusion?: string;
};

export async function getEvents(
  filters: EventFilters = {}
): Promise<GitHubEvent[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });

  const query = params.toString();

  const url = query
    ? `${API_BASE_URL}/events?${query}`
    : `${API_BASE_URL}/events`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  return response.json();
}