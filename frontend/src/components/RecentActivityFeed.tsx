import { useRecentEvents } from "../hooks/useRecentEvents";
import { parseUtcDate } from "../utils/time";
import { EVENT_TYPE_COLOR, SERIES_OTHER } from "../theme";

function timeAgo(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - parseUtcDate(iso).getTime()) / 1000));
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

export default function RecentActivityFeed() {
  const { events, isLoading } = useRecentEvents(15);

  return (
    <div className="activity-feed">
      <div className="activity-feed__header">
        <h2>Recent Activity</h2>
      </div>

      <div className="activity-feed__list">
        {isLoading ? (
          <p className="activity-feed__empty">Loading...</p>
        ) : events.length === 0 ? (
          <p className="activity-feed__empty">No recent events.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="activity-feed__item">
              <span
                className="activity-feed__dot"
                style={{ background: EVENT_TYPE_COLOR[event.event_type] ?? SERIES_OTHER }}
              />
              <div className="activity-feed__body">
                <span className="activity-feed__type">{formatType(event.event_type)}</span>
                <span className="activity-feed__repo">{event.repo_name}</span>
              </div>
              <div className="activity-feed__meta">
                {event.actor && (
                  <span className="activity-feed__actor">{event.actor}</span>
                )}
                <span className="activity-feed__time">{timeAgo(event.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
