'use client';

import { AlertTriangle, Command, Layers3, Search, Sparkles } from 'lucide-react';
import { Sidebar, type SidebarAction } from '@/components/shell/Sidebar';
import type {
  IntelligenceAlertSummary,
  MainWorkspaceSection,
  ProviderProfileSummary,
} from './intelligenceModel';
import { formatGraphNodeType } from '@/components/graph/state/graphDisplayState';

interface LeftSidebarProps {
  searchTerm: string;
  resultCount: number;
  activeSection: MainWorkspaceSection;
  watchlist: ProviderProfileSummary[];
  alerts: IntelligenceAlertSummary[];
  onSearchChange: (value: string) => void;
  onNavigate: (section: MainWorkspaceSection) => void;
  onSelectNode: (nodeId: string) => void;
  onOpenCommandPalette: () => void;
}

const NAV_ITEMS: Array<{ id: MainWorkspaceSection; label: string; detail: string }> = [
  {
    id: 'dashboards',
    label: 'Dashboards',
    detail: 'Portfolio health, verification velocity, and alert pressure.',
  },
  {
    id: 'profiles',
    label: 'Provider profiles',
    detail: 'Focused provider summaries and trust posture.',
  },
  {
    id: 'results',
    label: 'Search results',
    detail: 'Filtered providers matching the current workspace query.',
  },
];

function severityCopy(severity: IntelligenceAlertSummary['severity']): string {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'elevated':
      return 'elevated';
    case 'watch':
    default:
      return 'watch';
  }
}

export function LeftSidebar({
  searchTerm,
  resultCount,
  activeSection,
  watchlist,
  alerts,
  onSearchChange,
  onNavigate,
  onSelectNode,
  onOpenCommandPalette,
}: LeftSidebarProps) {
  const actions: SidebarAction[] = [
    {
      id: 'palette',
      label: 'Open command palette',
      icon: <Command className="h-3.5 w-3.5" />,
      onClick: onOpenCommandPalette,
    },
  ];

  return (
    <Sidebar
      actions={actions}
      subtitle="Search providers, pin watchlist entities, and keep operational alerts in view."
      title="LeftSidebar"
    >
      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Search</p>
            <h2 className="vital-panel__title">Provider intelligence query</h2>
          </div>
          <span className="vital-status-pill">{resultCount} matches</span>
        </div>
        <label className="vital-search-module" htmlFor="intelligence-sidebar-search">
          <Search className="vital-search-module__icon h-4 w-4" aria-hidden />
          <input
            id="intelligence-sidebar-search"
            className="vital-search-module__input"
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search providers, NPIs, institutions, evidence"
          />
        </label>
        <button
          type="button"
          className="vital-inline-action mt-3"
          onClick={onOpenCommandPalette}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span>Search providers, ask Copilot, or run verification with `Cmd+K`.</span>
        </button>
      </section>

      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Watchlist</p>
            <h2 className="vital-panel__title">Priority entities</h2>
          </div>
        </div>
        <div className="vital-stack-list">
          {watchlist.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="vital-entity-row"
              onClick={() => onSelectNode(profile.id)}
            >
              <div className="vital-entity-row__meta">
                <span className="vital-entity-row__title">{profile.title}</span>
                <span className="vital-entity-row__detail">
                  {formatGraphNodeType(profile.type)} • {profile.degree} relationships
                </span>
              </div>
              <span className={`vital-status-pill vital-status-pill--${profile.riskLevel}`}>
                {profile.trustTier ?? 'untiered'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Alerts</p>
            <h2 className="vital-panel__title">Trust pressure</h2>
          </div>
          <AlertTriangle className="h-4 w-4 text-[var(--vital-ops-accent-yellow)]" aria-hidden />
        </div>
        <div className="vital-stack-list">
          {alerts.length === 0 ? (
            <div className="vital-empty-state">No active alerts in the visible graph slice.</div>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                className="vital-alert-row"
                onClick={() => onSelectNode(alert.nodeId)}
              >
                <div className="vital-entity-row__meta">
                  <span className="vital-entity-row__title">{alert.title}</span>
                  <span className="vital-entity-row__detail">{alert.summary}</span>
                </div>
                <span className={`vital-status-pill vital-status-pill--${severityCopy(alert.severity)}`}>
                  {alert.severity}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Navigation</p>
            <h2 className="vital-panel__title">Workspace sections</h2>
          </div>
          <Layers3 className="h-4 w-4 text-[var(--vital-ops-accent-cyan)]" aria-hidden />
        </div>
        <div className="vital-stack-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`vital-nav-row ${activeSection === item.id ? 'vital-nav-row--active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <div className="vital-entity-row__meta">
                <span className="vital-entity-row__title">{item.label}</span>
                <span className="vital-entity-row__detail">{item.detail}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </Sidebar>
  );
}
