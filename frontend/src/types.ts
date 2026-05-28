export type GitHubEvent = {
  id: number;
  event_type: string;
  action?: string | null;
  repo_name: string;
  actor?: string | null;
  branch?: string | null;
  commit_sha?: string | null;
  status?: string | null;
  conclusion?: string | null;
  html_url?: string | null;
  created_at: string;
};