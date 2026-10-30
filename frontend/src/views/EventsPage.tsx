import { useMemo, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import EventDetailPanel from "../components/EventDetailPanel";
import EventTypeChart from "../components/EventTypeChart";
import TopActorsChart from "../components/TopActorsChart";
import { useEvents, type EventTypeFilter } from "../hooks/useEvents";
import { useEventTypeBreakdown } from "../hooks/useEventTypeBreakdown";
import { useTopActors } from "../hooks/useTopActors";
import type { GitHubEvent } from "../types";
import { EVENTS_PAGE_SIZE, firstError, type DashboardScope, type EventFilters } from "./filters";

type EventsPageProps = {
  scope: DashboardScope;
  filters: EventFilters;
  onFiltersChange: (patch: Partial<EventFilters>) => void;
};

export default function EventsPage({ scope, filters, onFiltersChange }: EventsPageProps) {
  const { repoName, startDate, endDate } = scope;
  const { eventType, actor, search, branch, conclusion, workflowName, page } = filters;
  const [selectedEvent, setSelectedEvent] = useState<GitHubEvent | null>(null);

  const query = useMemo(
    () => ({
      event_type: eventType,
      repo_name: repoName,
      actor,
      search,
      branch: branch || undefined,
      conclusion: conclusion || undefined,
      workflow_name: workflowName || undefined,
      start_date: startDate ?? undefined,
      end_date: endDate ?? undefined,
      limit: EVENTS_PAGE_SIZE,
      offset: page * EVENTS_PAGE_SIZE,
    }),
    [eventType, repoName, actor, search, branch, conclusion, workflowName, startDate, endDate, page]
  );

  const { events, total, isLoading, error: eventsError } = useEvents(query);
  const typeBreakdown = useEventTypeBreakdown(repoName, eventType, actor, startDate, endDate);
  const topActors = useTopActors(repoName, startDate, endDate, eventType, actor);

  const error = firstError(eventsError, typeBreakdown.error, topActors.error);

  return (
    <>
      <ErrorMessage error={error} />
      <div className="events-view">
        <div className="events-charts-row">
          <EventTypeChart
            data={typeBreakdown.eventTypeBreakdown}
            isLoading={typeBreakdown.isLoading}
            onDrillDown={(et) => onFiltersChange({ eventType: et as EventTypeFilter, page: 0 })}
          />
          <TopActorsChart
            data={topActors.topActors}
            isLoading={topActors.isLoading}
            onDrillDown={(a) => onFiltersChange({ actor: a, page: 0 })}
          />
        </div>

        {(branch || conclusion || workflowName) && (
          <div className="events-drill-chips">
            <span className="events-drill-chips__label">Filtered by:</span>
            {conclusion && (
              <button className="drill-chip" onClick={() => onFiltersChange({ conclusion: "", page: 0 })}>
                {conclusion} ×
              </button>
            )}
            {branch && (
              <button className="drill-chip" onClick={() => onFiltersChange({ branch: "", page: 0 })}>
                branch: {branch} ×
              </button>
            )}
            {workflowName && (
              <button className="drill-chip" onClick={() => onFiltersChange({ workflowName: "", page: 0 })}>
                workflow: {workflowName} ×
              </button>
            )}
            <button
              className="drill-chip drill-chip--clear"
              onClick={() => onFiltersChange({ branch: "", conclusion: "", workflowName: "", page: 0 })}
            >
              Clear all ×
            </button>
          </div>
        )}

        <section className="events-section">
          <h2>Events</h2>

          {!isLoading && (
            <div className="events-pagination">
              <span>
                {total === 0
                  ? "No events found"
                  : `Showing ${page * EVENTS_PAGE_SIZE + 1}–${Math.min((page + 1) * EVENTS_PAGE_SIZE, total)} of ${total}`}
              </span>
              {" "}
              <button onClick={() => onFiltersChange({ page: page - 1 })} disabled={page === 0}>
                Previous
              </button>
              {" "}
              <button
                onClick={() => onFiltersChange({ page: page + 1 })}
                disabled={(page + 1) * EVENTS_PAGE_SIZE >= total}
              >
                Next
              </button>
            </div>
          )}

          <div className="events-table-wrapper">
            {isLoading ? (
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

      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}
