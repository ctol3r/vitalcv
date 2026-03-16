'use client';

import { AlertTriangle, Layers3, LayoutPanelLeft, Search } from 'lucide-react';
import { Sidebar, type SidebarAction } from '@/components/shell/Sidebar';
import type {
  IntelligenceAlert,
  IntelligenceProvider,
  WorkspaceSectionId,
} from '@/lib/intelligence/contracts';
import { WORKSPACE_SECTIONS } from '@/lib/intelligence/layout';
import { ToneBadge } from './shared';

interface LeftSidebarProps {
  searchTerm: string;
  resultCount: number;
  activeSection: WorkspaceSectionId;
  watchlist: IntelligenceProvider[];
  alerts: IntelligenceAlert[];
  onSearchChange: (value: string) => void;
  onNavigate: (section: WorkspaceSectionId) => void;
  onSelectProvider: (providerNpi: string) => void;
}

export function LeftSidebar({
  searchTerm,
  resultCount,
  activeSection,
  watchlist,
  alerts,
  onSearchChange,
  onNavigate,
  onSelectProvider,
}: LeftSidebarProps) {
  const actions: SidebarAction[] = [
    {
      id: 'dashboard',
      label: 'Open dashboard',
      icon: <LayoutPanelLeft className="h-3.5 w-3.5" />,
      onClick: () => onNavigate('dashboard'),
    },
  ];

  return (
    <Sidebar
      actions={actions}
      subtitle="Search providers, pin a watchlist, and navigate between workspace sections."
      title="Provider Search"
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
            placeholder="Search providers, NPIs, specialties, issuers"
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-[var(--vt-text-3)]">
          Search scopes the provider feed. Selecting a provider pivots the graph, investigation workspace, and right-panel sources.
        </p>
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
              onClick={() => onSelectProvider(profile.npi)}
            >
              <div className="vital-entity-row__meta">
                <span className="vital-entity-row__title">{profile.name}</span>
                <span className="vital-entity-row__detail">
                  {profile.summary || profile.specialties.join(', ') || 'Provider'}
                </span>
              </div>
              <ToneBadge tone={profile.risk} label={`${profile.trustScore}`} />
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
                onClick={() => {
                  if (alert.providerNpi) {
                    onSelectProvider(alert.providerNpi);
                  }
                }}
              >
                <div className="vital-entity-row__meta">
                  <span className="vital-entity-row__title">{alert.title}</span>
                  <span className="vital-entity-row__detail">{alert.summary}</span>
                </div>
                <ToneBadge
                  tone={alert.severity === 'critical' ? 'critical' : alert.severity === 'high' || alert.severity === 'medium' ? 'degraded' : 'neutral'}
                  label={alert.source}
                />
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
          {WORKSPACE_SECTIONS.map((item) => (
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
