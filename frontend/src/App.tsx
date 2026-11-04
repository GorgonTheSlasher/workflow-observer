import { lazy, Suspense, useEffect, useState } from "react";
import { getMe, type UserProfile } from "./api";
import AppHeader from "./components/AppHeader";
import DemoBanner from "./components/DemoBanner";
import ErrorMessage from "./components/ErrorMessage";
import LoginPage from "./components/LoginPage";
import ServerWakeNotice from "./components/ServerWakeNotice";
import Sidebar from "./components/Sidebar";
import { EventStreamProvider } from "./context/EventStreamContext";
import { useAuth } from "./hooks/useAuth";
import { useRepositories } from "./hooks/useRepositories";
import {
  EMPTY_EVENT_FILTERS,
  type ActiveView,
  type DashboardScope,
  type EventDrillDown,
  type EventFilters,
} from "./views/filters";
import "./App.css";

// Each tab, and the charting library behind it, is downloaded the first time it's opened
const SummaryPage = lazy(() => import("./views/SummaryPage"));
const EventsPage = lazy(() => import("./views/EventsPage"));
const WorkflowsPage = lazy(() => import("./views/WorkflowsPage"));
const DoraPage = lazy(() => import("./views/DoraPage"));
const IssuesPage = lazy(() => import("./views/IssuesPage"));
const SettingsView = lazy(() => import("./components/SettingsView"));

function Dashboard() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scope, setScope] = useState<DashboardScope>({ repoName: "", startDate: null, endDate: null });
  const [eventFilters, setEventFilters] = useState<EventFilters>(EMPTY_EVENT_FILTERS);
  const { repositories, isLoading: isLoadingRepositories, error: repositoriesError } = useRepositories();

  useEffect(() => {
    getMe().then(setProfile).catch(() => null);
  }, []);

  function updateEventFilters(patch: Partial<EventFilters>) {
    setEventFilters((f) => ({ ...f, ...patch }));
  }

  function updateScope(patch: Partial<DashboardScope>) {
    setScope((s) => ({ ...s, ...patch }));
    updateEventFilters({ page: 0 });
  }

  function changeView(view: ActiveView) {
    setActiveView(view);
    updateEventFilters({ page: 0 });
  }

  // Clicking a chart on any tab opens the Events tab filtered to what was clicked
  function drillDownToEvents(drill: EventDrillDown) {
    const defined = Object.fromEntries(Object.entries(drill).filter(([, v]) => v !== undefined));
    updateEventFilters({ ...defined, page: 0 });
    setActiveView("events");
  }

  // Only the active tab is mounted, so only its data is fetched and refreshed on live updates
  function renderView() {
    switch (activeView) {
      case "summary":
        return <SummaryPage scope={scope} onDrillDown={drillDownToEvents} />;
      case "events":
        return <EventsPage scope={scope} filters={eventFilters} onFiltersChange={updateEventFilters} />;
      case "workflows":
        return <WorkflowsPage scope={scope} onDrillDown={drillDownToEvents} />;
      case "dora":
        return <DoraPage scope={scope} />;
      case "issues":
        return <IssuesPage scope={scope} onDrillDown={drillDownToEvents} />;
      case "settings":
        return <SettingsView />;
    }
  }

  return (
    <div className="page">
      <Sidebar
        activeView={activeView}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onViewChange={changeView}
      />

      <main>
        <AppHeader
          activeView={activeView}
          repositories={repositories}
          isLoadingRepositories={isLoadingRepositories}
          scope={scope}
          onScopeChange={updateScope}
          eventFilters={eventFilters}
          onEventFiltersChange={updateEventFilters}
          onLogout={logout}
        />

        {profile?.viewing_demo_data && <DemoBanner isDemoAccount={profile.is_demo} />}

        <ErrorMessage error={repositoriesError} />

        <Suspense fallback={<div className="chart-card chart-card--loading">Loading…</div>}>
          {renderView()}
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <ServerWakeNotice />
      {isAuthenticated ? (
        <EventStreamProvider>
          <Dashboard />
        </EventStreamProvider>
      ) : (
        <LoginPage />
      )}
    </>
  );
}

export default App;
