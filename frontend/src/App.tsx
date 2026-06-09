import { useMemo, useState } from "react";
import SummaryCards from "./components/SummaryCards";
import {
  useEvents,
  type EventTypeFilter,
} from "./hooks/useEvents";
import { useFailedWorkflowRuns } from "./hooks/useFailedWorkflowRuns";
import { useRepositories } from "./hooks/useRepositories";
import { useSummary } from "./hooks/useSummary";
import "./App.css";

function App() {
  const [eventType, setEventType] = useState<EventTypeFilter>("");
  const [selectedRepoName, setSelectedRepoName] = useState("");
  const {
    repositories,
    isLoading: isLoadingRepositories,
    error: repositoriesError,
  } = useRepositories();
  const repoName = selectedRepoName || repositories[0] || "";
  const {
    events,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useEvents(eventType, repoName);
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

  const error = useMemo(
    () => repositoriesError ?? summaryError ?? eventsError ?? failedWorkflowsError,
    [repositoriesError, summaryError, eventsError, failedWorkflowsError]
  );

  return (
    <main>
      <header>
        <h1>Workflow Observer</h1>
        <p>GitHub webhook activity and workflow health dashboard.</p>
      </header>

      <section>
        <h2>Filters</h2>

        <label htmlFor="repo-filter">Repository: </label>

        <select
          id="repo-filter"
          value={repoName}
          disabled={isLoadingRepositories || repositories.length === 0}
          onChange={(event) => setSelectedRepoName(event.target.value)}
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
          onChange={(event) =>
            setEventType(event.target.value as EventTypeFilter)
          }
        >
          <option value="">All Events</option>
          <option value="push">Push</option>
          <option value="pull_request">Pull Request</option>
          <option value="workflow_run">Workflow Run</option>
          <option value="issues">Issues</option>
          <option value="member">Member</option>
        </select>
      </section>

      {error && <p className="error">Error: {error}</p>}

      <SummaryCards summary={summary} isLoading={isLoadingSummary} />

      <section>
        <h2>Failed Workflows</h2>

        {isLoadingFailures ? (
          <p>Loading failed workflows...</p>
        ) : failedWorkflows.length === 0 ? (
          <p>No failed workflows found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Repo</th>
                <th>Actor</th>
                <th>Branch</th>
                <th>Commit</th>
                <th>Link</th>
              </tr>
            </thead>

            <tbody>
              {failedWorkflows.map((workflow) => (
                <tr key={workflow.id}>
                  <td>{workflow.repo_name}</td>
                  <td>{workflow.actor ?? "-"}</td>
                  <td>{workflow.branch ?? "-"}</td>
                  <td>{workflow.commit_sha?.slice(0, 7) ?? "-"}</td>
                  <td>
                    {workflow.html_url ? (
                      <a
                        href={workflow.html_url}
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

      <section>
        <h2>Events</h2>

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