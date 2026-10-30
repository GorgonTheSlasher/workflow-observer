import { getGithubInstallUrl } from "../api";
import type { EventTypeFilter } from "../hooks/useEvents";
import type { ActiveView, DashboardScope, EventFilters } from "../views/filters";
import DateRangePicker from "./DateRangePicker";

type AppHeaderProps = {
  activeView: ActiveView;
  repositories: string[];
  isLoadingRepositories: boolean;
  scope: DashboardScope;
  onScopeChange: (patch: Partial<DashboardScope>) => void;
  eventFilters: EventFilters;
  onEventFiltersChange: (patch: Partial<EventFilters>) => void;
  onLogout: () => void;
};

export default function AppHeader({
  activeView,
  repositories,
  isLoadingRepositories,
  scope,
  onScopeChange,
  eventFilters,
  onEventFiltersChange,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__brand">Workflow Observer</span>

        <select
          className="app-header__select app-header__select--repo"
          value={scope.repoName}
          disabled={isLoadingRepositories || repositories.length === 0}
          onChange={(e) => onScopeChange({ repoName: e.target.value })}
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
              value={eventFilters.eventType}
              onChange={(e) => onEventFiltersChange({ eventType: e.target.value as EventTypeFilter, page: 0 })}
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
              value={eventFilters.actor}
              placeholder="Actor"
              onChange={(e) => onEventFiltersChange({ actor: e.target.value, page: 0 })}
            />
          </>
        )}
      </div>

      <div className="app-header__right">
        {activeView === "events" && (
          <input
            className="app-header__input"
            type="search"
            value={eventFilters.search}
            placeholder="Search"
            onChange={(e) => onEventFiltersChange({ search: e.target.value, page: 0 })}
          />
        )}

        <DateRangePicker
          startDate={scope.startDate}
          endDate={scope.endDate}
          onChange={({ startDate, endDate }) => onScopeChange({ startDate, endDate })}
        />

        <button
          className="app-header__connect"
          onClick={() => { window.location.href = getGithubInstallUrl(); }}
        >
          Connect GitHub App
        </button>

        <button className="app-header__logout" onClick={onLogout}>
          Log Out
        </button>
      </div>
    </header>
  );
}
