import { useEffect, useState } from "react";
import { getRecentEvents } from "./api";
import type { GitHubEvent } from "./types";
import RecentEventsTable from "./components/RecentEventsTable";
import FailedWorkflowsTable from "./components/FailedWorkflowRunsTable";
import SummaryCards from "./components/SummaryCards";
import "./App.css";

function App() {
  const [recentEvents, setRecentEvents] = useState<GitHubEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecentEvents(50)
      .then(setRecentEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>Workflow Observer</h1>
      <p>GitHub webhook activity and workflow health dashboard.</p>

      {error && <p>Error loading summary data: {error}</p>}

      <SummaryCards events={recentEvents} />
      <FailedWorkflowsTable />
      <RecentEventsTable />
    </main>
  );
}

export default App;