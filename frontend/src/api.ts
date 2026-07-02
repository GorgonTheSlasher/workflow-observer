import type { GitHubEvent } from "./types";
import { authHeaders, notifyUnauthorized } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function apiFetch(url: string): Promise<Response> {
  const response = await fetch(url, { headers: authHeaders() });

  if (response.status === 401) {
    notifyUnauthorized();
  }

  return response;
}

async function readErrorDetail(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.detail ?? fallback;
}

export function getGithubLoginUrl(): string {
  return `${API_BASE_URL}/auth/github/login`;
}

const GITHUB_APP_SLUG = "workflow-observer";

export function getGithubInstallUrl(): string {
  return `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
}

export type AuthResponse = {
  access_token: string;
  token_type: string;
};

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, "Login failed"));
  }

  return response.json();
}

export type RegisteredUser = {
  id: number;
  email: string;
};

export async function registerUser(email: string, password: string): Promise<RegisteredUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, "Registration failed"));
  }

  return response.json();
}

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

type WorkflowRunResult = "success" | "failure";

type WorkflowRunsSummary = {
  repo_name: string;
  result: WorkflowRunResult;
  total_workflows: number;
  success_rate: number;
  count: number;
  workflows: GitHubEvent[];
};

export async function getSummary(): Promise<Summary> {
  const response = await apiFetch(`${API_BASE_URL}/summary`);

  if (!response.ok) {
    throw new Error("Failed to fetch summary");
  }

  return response.json();
}

export async function getRepositories(): Promise<string[]> {
  const response = await apiFetch(`${API_BASE_URL}/summary/repositories`);

  if (!response.ok) {
    throw new Error("Failed to fetch repositories");
  }

  return response.json();
}

export async function getRecentEvents(limit = 10): Promise<GitHubEvent[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/summary/events/recent?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recent events");
  }

  return response.json();
}

export async function getWorkflowRuns(
  repoName: string,
  result: WorkflowRunResult,
  sinceDays?: number | null,
): Promise<WorkflowRunsSummary> {
  const params = new URLSearchParams({ result });
  if (repoName) params.append("repo_name", repoName);
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const response = await apiFetch(
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


export type TimelineEntry = {
  date: string;
  push: number;
  pull_request: number;
  workflow_run: number;
  issues: number;
  member: number;
};

export async function getTimeline(
  repoName: string,
  sinceDays?: number | null,
): Promise<TimelineEntry[]> {
  const params = new URLSearchParams({ repo_name: repoName });
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const response = await apiFetch(`${API_BASE_URL}/summary/timeline?${params}`);
  if (!response.ok) throw new Error("Failed to fetch timeline");
  return response.json();
}

export type TopActorEntry = {
  actor: string;
  count: number;
};

export async function getTopActors(
  repoName: string,
  limit = 5,
  sinceDays?: number | null,
  eventType?: string,
  actor?: string,
): Promise<TopActorEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (repoName) params.append("repo_name", repoName);
  if (sinceDays != null) params.append("since_days", String(sinceDays));
  if (eventType) params.append("event_type", eventType);
  if (actor) params.append("actor", actor);
  const response = await apiFetch(`${API_BASE_URL}/summary/top-actors?${params}`);
  if (!response.ok) throw new Error("Failed to fetch top actors");
  return response.json();
}

export type EventTypeBreakdownEntry = {
  event_type: string;
  count: number;
};

export async function getEventTypeBreakdown(
  repoName?: string,
  eventType?: string,
  actor?: string,
  sinceDays?: number | null,
): Promise<EventTypeBreakdownEntry[]> {
  const params = new URLSearchParams();
  if (repoName) params.append("repo_name", repoName);
  if (eventType) params.append("event_type", eventType);
  if (actor) params.append("actor", actor);
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/summary/events/by-type?${query}`
    : `${API_BASE_URL}/summary/events/by-type`;

  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Failed to fetch event type breakdown");
  return response.json();
}

export type WorkflowFailuresByNameEntry = {
  workflow_name: string;
  count: number;
};

export async function getWorkflowFailuresByName(
  repoName?: string,
  sinceDays?: number | null,
): Promise<WorkflowFailuresByNameEntry[]> {
  const params = new URLSearchParams();
  if (repoName) params.append("repo_name", repoName);
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/summary/workflow-failures-by-name?${query}`
    : `${API_BASE_URL}/summary/workflow-failures-by-name`;

  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Failed to fetch workflow failures by name");
  return response.json();
}

export type WorkflowFailuresByBranchEntry = {
  branch: string;
  count: number;
};

export async function getWorkflowFailuresByBranch(
  repoName?: string,
  sinceDays?: number | null,
): Promise<WorkflowFailuresByBranchEntry[]> {
  const params = new URLSearchParams();
  if (repoName) params.append("repo_name", repoName);
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/summary/workflow-failures-by-branch?${query}`
    : `${API_BASE_URL}/summary/workflow-failures-by-branch`;

  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Failed to fetch workflow failures by branch");
  return response.json();
}

export type WorkflowRunTimelineEntry = {
  date: string;
  success: number;
  failure: number;
  other: number;
};

export async function getWorkflowRunTimeline(
  repoName?: string,
  sinceDays?: number | null,
): Promise<WorkflowRunTimelineEntry[]> {
  const params = new URLSearchParams();
  if (repoName) params.append("repo_name", repoName);
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/summary/workflow-runs/timeline?${query}`
    : `${API_BASE_URL}/summary/workflow-runs/timeline`;

  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Failed to fetch workflow run timeline");
  return response.json();
}

export type WorkflowExecutionTimeEntry = {
  workflow_name: string;
  avg_seconds: number;
  run_count: number;
};

export async function getWorkflowExecutionTimes(
  repoName?: string,
  sinceDays?: number | null,
): Promise<WorkflowExecutionTimeEntry[]> {
  const params = new URLSearchParams();
  if (repoName) params.append("repo_name", repoName);
  if (sinceDays != null) params.append("since_days", String(sinceDays));

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/summary/workflow-execution-times?${query}`
    : `${API_BASE_URL}/summary/workflow-execution-times`;

  const response = await apiFetch(url);
  if (!response.ok) throw new Error("Failed to fetch workflow execution times");
  return response.json();
}

export type EventFilters = {
  event_type?: string;
  repo_name?: string;
  actor?: string;
  conclusion?: string;
  search?: string;
  since_days?: number;
  limit?: number;
  offset?: number;
};

export type EventsPage = {
  total: number;
  events: GitHubEvent[];
};

export async function getEvents(
  filters: EventFilters = {}
): Promise<EventsPage> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.append(key, String(value));
    }
  });

  const query = params.toString();

  const url = query
    ? `${API_BASE_URL}/summary/events?${query}`
    : `${API_BASE_URL}/summary/events`;

  const response = await apiFetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  return response.json();
}