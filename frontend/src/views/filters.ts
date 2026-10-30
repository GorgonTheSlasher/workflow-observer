import type { EventTypeFilter } from "../hooks/useEvents";

export type ActiveView = "summary" | "events" | "workflows" | "dora" | "issues" | "settings";

// Header filters that apply to every chart on every tab
export type DashboardScope = {
  repoName: string;
  startDate: string | null;
  endDate: string | null;
};

// Filters for the Events tab. They live in the dashboard rather than the tab because
// clicking a bar or slice on another tab opens Events with some of them preset.
export type EventFilters = {
  eventType: EventTypeFilter;
  actor: string;
  search: string;
  branch: string;
  conclusion: string;
  workflowName: string;
  page: number;
};

export type EventDrillDown = Partial<Pick<EventFilters, "eventType" | "actor" | "branch" | "conclusion" | "workflowName">>;

export const EMPTY_EVENT_FILTERS: EventFilters = {
  eventType: "",
  actor: "",
  search: "",
  branch: "",
  conclusion: "",
  workflowName: "",
  page: 0,
};

export const EVENTS_PAGE_SIZE = 25;

export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}
