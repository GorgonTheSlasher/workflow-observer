import { useEffect, useState } from "react";
import { getRecentEvents } from "../api";
import type { GitHubEvent } from "../types";

export default function RecentEventsTable() {
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecentEvents(15)
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <section>
      <h2>Recent Events</h2>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Repo</th>
            <th>Actor</th>
            <th>Branch</th>
            <th>Status</th>
            <th>Conclusion</th>
          </tr>
        </thead>

        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.event_type}</td>
              <td>{event.repo_name}</td>
              <td>{event.actor ?? "-"}</td>
              <td>{event.branch ?? "-"}</td>
              <td>{event.status ?? "-"}</td>
              <td>{event.conclusion ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}