import { useMemo, useState } from "react";
import DateRangePicker from "./components/DateRangePicker";
import RecentWorkflowFailuresWidget from "./components/RecentWorkflowFailuresWidget";
import RecentActivityFeed from "./components/RecentActivityFeed";
import EventTypeChart from "./components/EventTypeChart";
import StatStrip from "./components/StatStrip";
import TimelineChart from "./components/TimelineChart";
import WorkflowHealthDonut from "./components/WorkflowHealthDonut";
import { usePrCycleTimes } from "./hooks/usePrCycleTimes";
import PrCycleTimeChart from "./components/PrCycleTimeChart";
import TopActorsChart from "./components/TopActorsChart";
import LoginPage from "./components/LoginPage";
import { useAuth } from "./hooks/useAuth";
import { EventStreamProvider } from "./context/EventStreamContext";
import { getGithubInstallUrl } from "./api";
import { useEvents, type EventTypeFilter } from "./hooks/useEvents";
import { useFailedWorkflowRuns } from "./hooks/useFailedWorkflowRuns";
import { useRepositories } from "./hooks/useRepositories";
import { useSummary } from "./hooks/useSummary";
import { useWorkflowRunBreakdown } from "./hooks/useWorkflowRunBreakdown";
import { useTimeline } from "./hooks/useTimeline";
import { useTopActors } from "./hooks/useTopActors";
import { useEventTypeBreakdown } from "./hooks/useEventTypeBreakdown";
import { useWorkflowFailuresByName } from "./hooks/useWorkflowFailuresByName";
import WorkflowFailuresByNameChart from "./components/WorkflowFailuresByNameChart";
import { useWorkflowRunTimeline } from "./hooks/useWorkflowRunTimeline";
import { useWorkflowExecutionTime } from "./hooks/useWorkflowExecutionTime";
import WorkflowExecutionTimeChart from "./components/WorkflowExecutionTimeChart";
import WorkflowRunTimelineChart from "./components/WorkflowRunTimelineChart";
import { useWorkflowFailuresByBranch } from "./hooks/useWorkflowFailuresByBranch";
import WorkflowFailuresByBranchChart from "./components/WorkflowFailuresByBranchChart";
import { useDora } from "./hooks/useDora";
import DoraView from "./components/DoraView";
import { useIssues } from "./hooks/useIssues";
import IssuesView from "./components/IssuesView";
import EventDetailPanel from "./components/EventDetailPanel";
import type { GitHubEvent } from "./types";
import "./App.css";

type ActiveView = "summary" | "events" | "workflows" | "dora" | "issues";

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

function DoraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" />
      <circle cx="9" cy="9" r="3.5" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IssuesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" />
      <line x1="9" y1="5.5" x2="9" y2="9.5" strokeLinecap="round" />
      <circle cx="9" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Dashboard() {
  const { logout } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRepoName, setSelectedRepoName] = useState("");
  const [eventType, setEventType] = useState<EventTypeFilter>("");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [drillBranch, setDrillBranch] = useState("");
  const [drillConclusion, setDrillConclusion] = useState("");
  const [drillWorkflowName, setDrillWorkflowName] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<GitHubEvent | null>(null);

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
      branch: drillBranch || undefined,
      conclusion: drillConclusion || undefined,
      workflow_name: drillWorkflowName || undefined,
      start_date: startDate ?? undefined,
      end_date: endDate ?? undefined,
      limit: 25,
      offset: page * 25,
    }),
    [eventType, repoName, actor, search, drillBranch, drillConclusion, drillWorkflowName, startDate, endDate, page]
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
  } = useWorkflowRunBreakdown(repoName, startDate, endDate);

  const {
    prCycleTimes,
    isLoading: isLoadingPrCycleTimes,
    error: prCycleTimesError,
  } = usePrCycleTimes(repoName, startDate, endDate);

  const {
    timeline,
    isLoading: isLoadingTimeline,
    error: timelineError,
  } = useTimeline(repoName, startDate, endDate);

  const {
    topActors,
    isLoading: isLoadingTopActors,
    error: topActorsError,
  } = useTopActors(repoName, startDate, endDate);

  const {
    eventTypeBreakdown,
    isLoading: isLoadingEventTypeBreakdown,
    error: eventTypeBreakdownError,
  } = useEventTypeBreakdown(repoName, eventType, actor, startDate, endDate);

  const {
    topActors: eventsTopActors,
    isLoading: isLoadingEventsTopActors,
    error: eventsTopActorsError,
  } = useTopActors(repoName, startDate, endDate, eventType, actor);

  const {
    workflowFailuresByName,
    isLoading: isLoadingWorkflowFailuresByName,
    error: workflowFailuresByNameError,
  } = useWorkflowFailuresByName(repoName, startDate, endDate);

  const {
    executionTimes,
    isLoading: isLoadingExecutionTimes,
    error: executionTimesError,
  } = useWorkflowExecutionTime(repoName, startDate, endDate);

  const {
    workflowRunTimeline,
    isLoading: isLoadingWorkflowRunTimeline,
    error: workflowRunTimelineError,
  } = useWorkflowRunTimeline(repoName, startDate, endDate);

  const {
    workflowFailuresByBranch,
    isLoading: isLoadingWorkflowFailuresByBranch,
    error: workflowFailuresByBranchError,
  } = useWorkflowFailuresByBranch(repoName, startDate, endDate);

  const {
    dora,
    isLoading: isLoadingDora,
    error: doraError,
  } = useDora(repoName, startDate, endDate);

  const {
    stats: issueStats,
    activity: issueActivity,
    labels: issueLabels,
    resolutionTrend: issueResolutionTrend,
    reporters: issueReporters,
    isLoading: isLoadingIssues,
    error: issuesError,
  } = useIssues(repoName, startDate, endDate);

  const error = useMemo(
    () =>
      repositoriesError ??
      summaryError ??
      workflowRunBreakdownError ??
      prCycleTimesError ??
      timelineError ??
      topActorsError ??
      eventTypeBreakdownError ??
      eventsTopActorsError ??
      workflowFailuresByNameError ??
      executionTimesError ??
      workflowRunTimelineError ??
      workflowFailuresByBranchError ??
      doraError ??
      issuesError ??
      eventsError ??
      failedWorkflowsError,
    [
      repositoriesError,
      summaryError,
      workflowRunBreakdownError,
      prCycleTimesError,
      timelineError,
      topActorsError,
      eventTypeBreakdownError,
      eventsTopActorsError,
      workflowFailuresByNameError,
      executionTimesError,
      workflowRunTimelineError,
      workflowFailuresByBranchError,
      doraError,
      issuesError,
      eventsError,
      failedWorkflowsError,
    ]
  );

  function handleViewChange(view: ActiveView) {
    setActiveView(view);
    setPage(0);
  }

  function navigateToEvents(filters: {
    event_type?: EventTypeFilter;
    actor?: string;
    branch?: string;
    conclusion?: string;
    workflow_name?: string;
  }) {
    if (filters.event_type !== undefined) setEventType(filters.event_type);
    if (filters.actor !== undefined) setActor(filters.actor);
    if (filters.branch !== undefined) setDrillBranch(filters.branch);
    if (filters.conclusion !== undefined) setDrillConclusion(filters.conclusion);
    if (filters.workflow_name !== undefined) setDrillWorkflowName(filters.workflow_name);
    setPage(0);
    handleViewChange("events");
  }

  function clearDrillFilters() {
    setDrillBranch("");
    setDrillConclusion("");
    setDrillWorkflowName("");
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
          <button
            className={`sidebar__nav-item${activeView === "dora" ? " sidebar__nav-item--active" : ""}`}
            onClick={() => handleViewChange("dora")}
            aria-label="DORA Metrics"
          >
            <DoraIcon />
            {sidebarOpen && <span>DORA Metrics</span>}
          </button>
          <button
            className={`sidebar__nav-item${activeView === "issues" ? " sidebar__nav-item--active" : ""}`}
            onClick={() => handleViewChange("issues")}
            aria-label="Issues"
          >
            <IssuesIcon />
            {sidebarOpen && <span>Issues</span>}
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

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s);
                setEndDate(e);
                setPage(0);
              }}
            />

            <button
              className="app-header__connect"
              onClick={() => { window.location.href = getGithubInstallUrl(); }}
            >
              Connect GitHub App
            </button>

            <button className="app-header__logout" onClick={logout}>
              Log Out
            </button>
          </div>
        </header>

        {error && <p className="error">Error: {error}</p>}

        {activeView === "summary" && (
          <div className="summary-view">
            <StatStrip summary={summary} isLoading={isLoadingSummary} />
            <div className="summary-section">
              <div className="summary-section__left">
                <RecentActivityFeed />
              </div>
              <div className="summary-section__chart">
                <TopActorsChart
                  data={topActors}
                  isLoading={isLoadingTopActors}
                  onDrillDown={(a) => navigateToEvents({ actor: a })}
                />
              </div>
              <div className="summary-section__chart">
                <WorkflowHealthDonut
                  workflowRunBreakdown={workflowRunBreakdown}
                  isLoading={isLoadingWorkflowRunBreakdown}
                />
              </div>
            </div>
            <div className="summary-charts-row">
              <TimelineChart data={timeline} isLoading={isLoadingTimeline} />
              <PrCycleTimeChart data={prCycleTimes} isLoading={isLoadingPrCycleTimes} />
            </div>
          </div>
        )}

        {activeView === "events" && (
          <div className="events-view">
            <div className="events-charts-row">
              <EventTypeChart
                data={eventTypeBreakdown}
                isLoading={isLoadingEventTypeBreakdown}
                onDrillDown={(et) => navigateToEvents({ event_type: et as EventTypeFilter })}
              />
              <TopActorsChart
                data={eventsTopActors}
                isLoading={isLoadingEventsTopActors}
                onDrillDown={(a) => navigateToEvents({ actor: a })}
              />
            </div>

            {(drillBranch || drillConclusion || drillWorkflowName) && (
              <div className="events-drill-chips">
                <span className="events-drill-chips__label">Filtered by:</span>
                {drillConclusion && (
                  <button className="drill-chip" onClick={() => setDrillConclusion("")}>
                    {drillConclusion} ×
                  </button>
                )}
                {drillBranch && (
                  <button className="drill-chip" onClick={() => setDrillBranch("")}>
                    branch: {drillBranch} ×
                  </button>
                )}
                {drillWorkflowName && (
                  <button className="drill-chip" onClick={() => setDrillWorkflowName("")}>
                    workflow: {drillWorkflowName} ×
                  </button>
                )}
                <button className="drill-chip drill-chip--clear" onClick={clearDrillFilters}>
                  Clear all ×
                </button>
              </div>
            )}

            <section className="events-section">
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

              <div className="events-table-wrapper">
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
                        <tr
                          key={event.id}
                          className="events-table__row--clickable"
                          onClick={() => setSelectedEvent(event)}
                        >
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
                                onClick={(e) => e.stopPropagation()}
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
              </div>
            </section>
          </div>
        )}

        {activeView === "workflows" && (
          <div className="workflows-view">
            <div className="workflows-charts-row">
              <WorkflowFailuresByBranchChart
                data={workflowFailuresByBranch}
                isLoading={isLoadingWorkflowFailuresByBranch}
                onDrillDown={(b) => navigateToEvents({ event_type: "workflow_run", conclusion: "failure", branch: b })}
              />
              <WorkflowFailuresByNameChart
                data={workflowFailuresByName}
                isLoading={isLoadingWorkflowFailuresByName}
                onDrillDown={(n) => navigateToEvents({ event_type: "workflow_run", conclusion: "failure", workflow_name: n })}
              />
              <WorkflowExecutionTimeChart
                data={executionTimes}
                isLoading={isLoadingExecutionTimes}
              />
            </div>
            <div className="workflows-bottom-row">
              <WorkflowRunTimelineChart
                data={workflowRunTimeline}
                isLoading={isLoadingWorkflowRunTimeline}
              />
              <RecentWorkflowFailuresWidget
                failures={failedWorkflows}
                limit={4}
                isLoading={isLoadingFailures}
              />
            </div>
          </div>
        )}

        {activeView === "dora" && (
          <DoraView data={dora} isLoading={isLoadingDora} />
        )}

        {activeView === "issues" && (
          <IssuesView
            stats={issueStats}
            activity={issueActivity}
            labels={issueLabels}
            resolutionTrend={issueResolutionTrend}
            reporters={issueReporters}
            isLoading={isLoadingIssues}
            onDrillDown={(filters) => navigateToEvents({
              event_type: filters.event_type as EventTypeFilter | undefined,
              actor: filters.actor,
            })}
          />
        )}
      </main>

      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <EventStreamProvider>
      <Dashboard />
    </EventStreamProvider>
  );
}

export default App;
