import type { GitHubEvent } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type Summary = {
  total_events: number;
  total_repositories: number;
  total_unique_actors: number;
  total_members: number;
  total_issues: number;
  total_pull_requests?: number;
  total_pushes: number;
  total_workflows: number;
};

export type WorkflowRunResult = "success" | "failure";

export type WorkflowRunsSummary = {
  repo_name: string;
  result: WorkflowRunResult;
  total_workflows: number;
  success_rate: number;
  count: number;
  workflows: GitHubEvent[];
};

export type RepositorySummary = {
  repo_name: string;
  total_events: number;
  failed_workflows: number;
  successful_workflows: number;
};

export async function getSummary(): Promise<Summary> {
  const response = await fetch(`${API_BASE_URL}/summary`);

  if (!response.ok) {
    throw new Error("Failed to fetch summary");
  }

  return response.json();
}

export async function getRepositories(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/summary/repositories`);

  if (!response.ok) {
    throw new Error("Failed to fetch repositories");
  }

  return response.json();
}

export async function getRecentEvents(limit = 10): Promise<GitHubEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/summary/events/recent?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recent events");
  }

  return response.json();
}

export async function getWorkflowRuns(
  repoName: string,
  result: WorkflowRunResult
): Promise<WorkflowRunsSummary> {
  const params = new URLSearchParams({
    repo_name: repoName,
    result,
  });

  const response = await fetch(
    `${API_BASE_URL}/summary/events/workflow-runs?${params}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${result} workflow runs`);
  }

  return response.json();
}

export async function getFailedWorkflowRuns(
  repoName: string
): Promise<GitHubEvent[]> {
  const data = await getWorkflowRuns(repoName, "failure");
  return data.workflows;
}

export async function getRepositorySummary(
  repoName: string
): Promise<RepositorySummary> {
  const params = new URLSearchParams({ repo_name: repoName });

  const response = await fetch(`${API_BASE_URL}/summary/repository?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch repository summary");
  }

  return response.json();
}

export async function getActorActivity(actor: string): Promise<GitHubEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/summary/${encodeURIComponent(actor)}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch actor activity");
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
    ? `${API_BASE_URL}/summary/events?${query}`
    : `${API_BASE_URL}/summary/events`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  return response.json();
}