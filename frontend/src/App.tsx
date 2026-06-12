import { useMemo, useState } from "react";
import RecentWorkflowFailuresWidget from "./components/RecentWorkflowFailuresWidget";
import SummaryCharts from "./components/SummaryCharts";
import SummaryCards from "./components/SummaryCards";
import {
  useEvents,
  type ConclusionFilter,
  type EventTypeFilter,
} from "./hooks/useEvents";
import { useFailedWorkflowRuns } from "./hooks/useFailedWorkflowRuns";
import { useRepositories } from "./hooks/useRepositories";
import { useSummary } from "./hooks/useSummary";
import { useWorkflowRunBreakdown } from "./hooks/useWorkflowRunBreakdown";
import "./App.css";

const DATE_OPTIONS = [
  { label: "All time", value: null },
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function App() {
  const [eventType, setEventType] = useState<EventTypeFilter>("");
  const [selectedRepoName, setSelectedRepoName] = useState("");
  const [actor, setActor] = useState("");
  const [conclusion, setConclusion] = useState<ConclusionFilter>("");
  const [search, setSearch] = useState("");
  const [sinceDays, setSinceDays] = useState<number | null>(null);
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(0);
  const {
    repositories,
    isLoading: isLoadingRepositories,
    error: repositoriesError,
  } = useRepositories();
  const repoName = selectedRepoName || repositories[0] || "";
  const eventFilters = useMemo(
    () => ({
      event_type: eventType,
      repo_name: repoName,
      actor,
      conclusion,
      search,
      since_days: sinceDays ?? undefined,
      limit,
      offset: page * limit,
    }),
    [eventType, repoName, actor, conclusion, search, sinceDays, limit, page]
  );
  const {
    events,
    total,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useEvents(eventFilters);
  const {
    failedWorkflows,
    isLoading: isLoadingFailures,
    error: failedWorkflowsError,
  } = useFailedWorkflowRuns(repoName);
  const {
    summary,
    isLoading: isLoadingSummary,
    error: summaryError,
  } = useSummary();
  const {
    workflowRunBreakdown,
    isLoading: isLoadingWorkflowRunBreakdown,
    error: workflowRunBreakdownError,
  } = useWorkflowRunBreakdown(repoName);

  const error = useMemo(
    () =>
      repositoriesError ??
      summaryError ??
      workflowRunBreakdownError ??
      eventsError ??
      failedWorkflowsError,
    [
      repositoriesError,
      summaryError,
      workflowRunBreakdownError,
      eventsError,
      failedWorkflowsError,
    ]
  );

  return (
    <main>
      <header>
        <h1>Workflow Observer</h1>
        <p>GitHub webhook activity and workflow health dashboard.</p>
      </header>

      {error && <p className="error">Error: {error}</p>}

      <SummaryCards summary={summary} isLoading={isLoadingSummary} />

      <SummaryCharts
        summary={summary}
        workflowRunBreakdown={workflowRunBreakdown}
        isLoading={isLoadingSummary || isLoadingWorkflowRunBreakdown}
      />

      <RecentWorkflowFailuresWidget
        failures={failedWorkflows}
        isLoading={isLoadingFailures}
      />

      <section>
        <h2>Filters</h2>

        <label htmlFor="repo-filter">Repository: </label>

        <select
          id="repo-filter"
          value={repoName}
          disabled={isLoadingRepositories || repositories.length === 0}
          onChange={(event) => { setSelectedRepoName(event.target.value); setPage(0); }}
        >
          {repositories.length === 0 ? (
            <option value="">No repositories found</option>
          ) : (
            repositories.map((repository) => (
              <option key={repository} value={repository}>
                {repository}
              </option>
            ))
          )}
        </select>

        {" "}

        <label htmlFor="event-type-filter">Event Type: </label>

        <select
          id="event-type-filter"
          value={eventType}
          onChange={(event) => { setEventType(event.target.value as EventTypeFilter); setPage(0); }}
        >
          <option value="">All Events</option>
          <option value="push">Push</option>
          <option value="pull_request">Pull Request</option>
          <option value="workflow_run">Workflow Run</option>
          <option value="issues">Issues</option>
          <option value="member">Member</option>
        </select>

        {" "}

        <label htmlFor="actor-filter">Actor: </label>

        <input
          id="actor-filter"
          type="text"
          value={actor}
          placeholder="Exact actor"
          onChange={(event) => { setActor(event.target.value); setPage(0); }}
        />

        {" "}

        <label htmlFor="conclusion-filter">Conclusion: </label>

        <select
          id="conclusion-filter"
          value={conclusion}
          onChange={(event) => { setConclusion(event.target.value as ConclusionFilter); setPage(0); }}
        >
          <option value="">All Conclusions</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="cancelled">Cancelled</option>
          <option value="skipped">Skipped</option>
        </select>

        {" "}

        <label htmlFor="search-filter">Search: </label>

        <input
          id="search-filter"
          type="search"
          value={search}
          placeholder="Repo, actor, branch, SHA"
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
        />

        {" "}

        <label htmlFor="since-filter">Date Range: </label>

        <select
          id="since-filter"
          value={sinceDays ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            setSinceDays(raw === "" ? null : Number(raw));
            setPage(0);
          }}
        >
          {DATE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value ?? ""}>
              {opt.label}
            </option>
          ))}
        </select>

        {" "}

        <label htmlFor="limit-filter">Per page: </label>

        <input
          id="limit-filter"
          type="number"
          min="1"
          max="500"
          value={limit}
          onChange={(event) => { setLimit(Number(event.target.value) || 50); setPage(0); }}
        />
      </section>

      <section>
        <h2>Events</h2>

        {!isLoadingEvents && (
          <div>
            <span>
              {total === 0
                ? "No events found"
                : `Showing ${page * limit + 1}–${Math.min((page + 1) * limit, total)} of ${total}`}
            </span>
            {" "}
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              Previous
            </button>
            {" "}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
            >
              Next
            </button>
          </div>
        )}

        {isLoadingEvents ? (
          <p>Loading events...</p>
        ) : events.length === 0 ? (
          <p>No events found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Action</th>
                <th>Repo</th>
                <th>Actor</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Conclusion</th>
                <th>Link</th>
              </tr>
            </thead>

            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.event_type}</td>
                  <td>{event.action ?? "-"}</td>
                  <td>{event.repo_name}</td>
                  <td>{event.actor ?? "-"}</td>
                  <td>{event.branch ?? "-"}</td>
                  <td>{event.status ?? "-"}</td>
                  <td>{event.conclusion ?? "-"}</td>
                  <td>
                    {event.html_url ? (
                      <a
                        href={event.html_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

export default App;