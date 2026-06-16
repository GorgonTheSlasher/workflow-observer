import { useMemo, useState } from "react";
import RecentWorkflowFailuresWidget from "./components/RecentWorkflowFailuresWidget";
import SummaryCharts from "./components/SummaryCharts";
import SummaryCards from "./components/SummaryCards";
import TimelineChart from "./components/TimelineChart";
import FailureTrendRadar from "./components/FailureTrendRadar";
import WorkflowHealthDonut from "./components/WorkflowHealthDonut";
import TopActorsChart from "./components/TopActorsChart";
import { useEvents, type EventTypeFilter } from "./hooks/useEvents";
import { useFailedWorkflowRuns } from "./hooks/useFailedWorkflowRuns";
import { useRepositories } from "./hooks/useRepositories";
import { useSummary } from "./hooks/useSummary";
import { useWorkflowRunBreakdown } from "./hooks/useWorkflowRunBreakdown";
import { useTimeline } from "./hooks/useTimeline";
import { useFailureTrend } from "./hooks/useFailureTrend";
import { useTopActors } from "./hooks/useTopActors";
import "./App.css";

type ActiveView = "summary" | "events" | "workflows";

const DATE_OPTIONS = [
  { label: "All time", value: null },
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function SummaryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="7" height="7" rx="1" />
      <rect x="10" y="1" width="7" height="7" rx="1" />
      <rect x="1" y="10" width="7" height="7" rx="1" />
      <rect x="10" y="10" width="7" height="7" rx="1" />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <rect x="1" y="3" width="16" height="2" rx="1" />
      <rect x="1" y="8" width="16" height="2" rx="1" />
      <rect x="1" y="13" width="10" height="2" rx="1" />
    </svg>
  );
}

function WorkflowsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="3" cy="9" r="2" />
      <circle cx="15" cy="4" r="2" />
      <circle cx="15" cy="14" r="2" />
      <line x1="5" y1="8.3" x2="13" y2="5" />
      <line x1="5" y1="9.7" x2="13" y2="13" />
    </svg>
  );
}

function App() {
  const [activeView, setActiveView] = useState<ActiveView>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedRepoName, setSelectedRepoName] = useState("");
  const [eventType, setEventType] = useState<EventTypeFilter>("");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");
  const [sinceDays, setSinceDays] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const {
    repositories,
    isLoading: isLoadingRepositories,
    error: repositoriesError,
  } = useRepositories();

  const repoName = selectedRepoName;

  const eventFilters = useMemo(
    () => ({
      event_type: eventType,
      repo_name: repoName,
      actor,
      search,
      since_days: sinceDays ?? undefined,
      limit: 25,
      offset: page * 25,
    }),
    [eventType, repoName, actor, search, sinceDays, page]
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

  const {
    timeline,
    isLoading: isLoadingTimeline,
    error: timelineError,
  } = useTimeline(repoName, sinceDays);

  const {
    failureTrend,
    isLoading: isLoadingFailureTrend,
    error: failureTrendError,
  } = useFailureTrend(repoName);
  const {
    topActors,
    isLoading: isLoadingTopActors,
    error: topActorsError,
  } = useTopActors(repoName);

  const error = useMemo(
    () =>
      repositoriesError ??
      summaryError ??
      workflowRunBreakdownError ??
      timelineError ??
      failureTrendError ??
      topActorsError ??
      eventsError ??
      failedWorkflowsError,
    [
      repositoriesError,
      summaryError,
      workflowRunBreakdownError,
      timelineError,
      failureTrendError,
      topActorsError,
      eventsError,
      failedWorkflowsError,
    ]
  );

  function handleViewChange(view: ActiveView) {
    setActiveView(view);
    setPage(0);
  }

  return (
    <div className="page">
      <aside className={`sidebar${sidebarOpen ? "" : " sidebar--closed"}`}>
        <button
          className="sidebar__toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          ☰
        </button>

        <nav className="sidebar__nav">
          <button
            className={`sidebar__nav-item${activeView === "summary" ? " sidebar__nav-item--active" : ""}`}
            onClick={() => handleViewChange("summary")}
            aria-label="Summary"
          >
            <SummaryIcon />
            {sidebarOpen && <span>Summary</span>}
          </button>
          <button
            className={`sidebar__nav-item${activeView === "events" ? " sidebar__nav-item--active" : ""}`}
            onClick={() => handleViewChange("events")}
            aria-label="Events"
          >
            <EventsIcon />
            {sidebarOpen && <span>Events</span>}
          </button>
          <button
            className={`sidebar__nav-item${activeView === "workflows" ? " sidebar__nav-item--active" : ""}`}
            onClick={() => handleViewChange("workflows")}
            aria-label="Workflow Runs"
          >
            <WorkflowsIcon />
            {sidebarOpen && <span>Workflow Runs</span>}
          </button>
        </nav>
      </aside>

      <main>
        <header className="app-header">
          <div className="app-header__left">
            <span className="app-header__brand">Workflow Observer</span>

            <select
              className="app-header__select app-header__select--repo"
              value={repoName}
              disabled={isLoadingRepositories || repositories.length === 0}
              onChange={(e) => { setSelectedRepoName(e.target.value); setPage(0); }}
            >
              <option value="">All Repos</option>
              {repositories.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {activeView === "events" && (
              <>
                <select
                  className="app-header__select"
                  value={eventType}
                  onChange={(e) => { setEventType(e.target.value as EventTypeFilter); setPage(0); }}
                >
                  <option value="">All Types</option>
                  <option value="push">Push</option>
                  <option value="pull_request">Pull Request</option>
                  <option value="workflow_run">Workflow Run</option>
                  <option value="issues">Issues</option>
                  <option value="member">Member</option>
                </select>

                <input
                  className="app-header__input"
                  type="text"
                  value={actor}
                  placeholder="Actor"
                  onChange={(e) => { setActor(e.target.value); setPage(0); }}
                />
              </>
            )}
          </div>

          <div className="app-header__right">
            {activeView !== "workflows" && (
              <input
                className="app-header__input"
                type="search"
                value={search}
                placeholder="Search"
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            )}

            <select
              className="app-header__select"
              value={sinceDays ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setSinceDays(raw === "" ? null : Number(raw));
                setPage(0);
              }}
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ""}>{opt.label}</option>
              ))}
            </select>

          </div>
        </header>

        {error && <p className="error">Error: {error}</p>}

        {activeView === "summary" && (
          <div className="summary-view">
            <div className="summary-section">
              <SummaryCards summary={summary} isLoading={isLoadingSummary} />
              <div className="summary-section__chart">
                <TopActorsChart data={topActors} isLoading={isLoadingTopActors} />
              </div>
            </div>
            <div className="summary-charts-row">
              <TimelineChart data={timeline} isLoading={isLoadingTimeline} />
              <WorkflowHealthDonut
                workflowRunBreakdown={workflowRunBreakdown}
                isLoading={isLoadingWorkflowRunBreakdown}
              />
            </div>
          </div>
        )}

        {activeView === "events" && (
          <>
            <SummaryCharts
              mode="event-types"
              summary={summary}
              workflowRunBreakdown={workflowRunBreakdown}
              isLoading={isLoadingSummary || isLoadingWorkflowRunBreakdown}
            />

            <section>
              <h2>Events</h2>

              {!isLoadingEvents && (
                <div className="events-pagination">
                  <span>
                    {total === 0
                      ? "No events found"
                      : `Showing ${page * 25 + 1}–${Math.min((page + 1) * 25, total)} of ${total}`}
                  </span>
                  {" "}
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                    Previous
                  </button>
                  {" "}
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * 25 >= total}
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
                            <a href={event.html_url} target="_blank" rel="noreferrer">
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
          </>
        )}

        {activeView === "workflows" && (
          <>
            <SummaryCharts
              mode="workflow-outcomes"
              summary={summary}
              workflowRunBreakdown={workflowRunBreakdown}
              isLoading={isLoadingSummary || isLoadingWorkflowRunBreakdown}
            />
            <FailureTrendRadar data={failureTrend} isLoading={isLoadingFailureTrend} />
            <RecentWorkflowFailuresWidget
              failures={failedWorkflows}
              isLoading={isLoadingFailures}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
