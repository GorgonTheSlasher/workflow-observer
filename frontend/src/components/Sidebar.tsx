import type { ReactNode } from "react";
import type { ActiveView } from "../views/filters";

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

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.6 3.6l1.4 1.4M13 13l1.4 1.4M3.6 14.4l1.4-1.4M13 5l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: { view: ActiveView; label: string; icon: ReactNode; bottom?: boolean }[] = [
  { view: "summary", label: "Summary", icon: <SummaryIcon /> },
  { view: "events", label: "Events", icon: <EventsIcon /> },
  { view: "workflows", label: "Workflow Runs", icon: <WorkflowsIcon /> },
  { view: "dora", label: "DORA Metrics", icon: <DoraIcon /> },
  { view: "issues", label: "Issues", icon: <IssuesIcon /> },
  { view: "settings", label: "Settings", icon: <SettingsIcon />, bottom: true },
];

type SidebarProps = {
  activeView: ActiveView;
  isOpen: boolean;
  onToggle: () => void;
  onViewChange: (view: ActiveView) => void;
};

export default function Sidebar({ activeView, isOpen, onToggle, onViewChange }: SidebarProps) {
  return (
    <aside className={`sidebar${isOpen ? "" : " sidebar--closed"}`}>
      <button
        className="sidebar__toggle"
        onClick={onToggle}
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        ☰
      </button>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ view, label, icon, bottom }) => (
          <button
            key={view}
            className={[
              "sidebar__nav-item",
              bottom && "sidebar__nav-item--bottom",
              activeView === view && "sidebar__nav-item--active",
            ].filter(Boolean).join(" ")}
            onClick={() => onViewChange(view)}
            aria-label={label}
          >
            {icon}
            {isOpen && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
