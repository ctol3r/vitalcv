'use client';

import { Activity, ShieldCheck, Siren, Sparkles } from 'lucide-react';
import type {
  IntelligenceMetric,
  MainWorkspaceSection,
  ProviderProfileSummary,
  VerificationRunSummary,
} from './intelligenceModel';
import { formatGraphNodeType } from '@/components/graph/state/graphDisplayState';

interface MainWorkspaceProps {
  activeSection: MainWorkspaceSection;
  searchTerm: string;
  selectedProfile: ProviderProfileSummary | null;
  profiles: ProviderProfileSummary[];
  searchResults: ProviderProfileSummary[];
  metrics: IntelligenceMetric[];
  verificationRun: VerificationRunSummary | null;
  onNavigate: (section: MainWorkspaceSection) => void;
  onSelectProfile: (nodeId: string) => void;
  onRunVerification: (target: string) => void;
}

function confidenceCopy(confidence: number | null): string {
  if (confidence == null) {
    return 'No confidence';
  }

  return `${Math.round(confidence * 100)}% confidence`;
}

export function MainWorkspace({
  activeSection,
  searchTerm,
  selectedProfile,
  profiles,
  searchResults,
  metrics,
  verificationRun,
  onNavigate,
  onSelectProfile,
  onRunVerification,
}: MainWorkspaceProps) {
  const featuredProfile = selectedProfile ?? profiles[0] ?? null;

  return (
    <div className="vital-workspace-scroll">
      <section className="vital-panel vital-panel--dense vital-workspace-hero">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">MainWorkspace</p>
            <h2 className="vital-panel__title">Provider intelligence shell</h2>
          </div>
          <div className="vital-chip-list">
            <button type="button" className="vital-chip vital-chip--active" onClick={() => onNavigate('dashboards')}>
              Dashboards
            </button>
            <button type="button" className="vital-chip" onClick={() => onNavigate('profiles')}>
              Provider profiles
            </button>
            <button type="button" className="vital-chip" onClick={() => onNavigate('results')}>
              Search results
            </button>
          </div>
        </div>
        <p className="vital-panel__copy">
          Use the shell to move between portfolio dashboards, focused provider profiles, and
          search results without losing graph context or source evidence.
        </p>
        {verificationRun ? (
          <div className={`vital-verification-banner vital-verification-banner--${verificationRun.status}`}>
            <div>
              <p className="vital-panel__eyebrow">Verification run</p>
              <h3 className="vital-panel__title">{verificationRun.target}</h3>
            </div>
            <div className="vital-entity-row__meta">
              <span className="vital-entity-row__detail">{verificationRun.summary}</span>
              <span className="vital-entity-row__detail">
                {verificationRun.score == null ? 'Manual review' : `${verificationRun.score}% verification score`}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <section
        id="workspace-dashboards"
        className={`vital-intel-section ${activeSection === 'dashboards' ? 'vital-intel-section--active' : ''}`}
      >
        <div className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">Dashboards</p>
              <h2 className="vital-panel__title">Portfolio telemetry</h2>
            </div>
            <Activity className="h-4 w-4 text-[var(--vital-ops-accent-cyan)]" aria-hidden />
          </div>
          <div className="vital-metric-grid">
            {metrics.map((metric) => (
              <article key={metric.id} className={`vital-metric-card vital-metric-card--${metric.tone}`}>
                <span className="vital-kpi__label">{metric.label}</span>
                <span className="vital-kpi__value">{metric.value}</span>
                <span className="vital-entity-row__detail">{metric.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="workspace-profiles"
        className={`vital-intel-section ${activeSection === 'profiles' ? 'vital-intel-section--active' : ''}`}
      >
        <div className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">Provider profiles</p>
              <h2 className="vital-panel__title">Focused trust brief</h2>
            </div>
            <ShieldCheck className="h-4 w-4 text-[var(--vital-ops-success)]" aria-hidden />
          </div>

          {featuredProfile ? (
            <div className="vital-profile-spotlight">
              <div className="vital-profile-spotlight__summary">
                <div className="vital-chip-list">
                  <span className="vital-status-pill">{formatGraphNodeType(featuredProfile.type)}</span>
                  {featuredProfile.trustTier ? (
                    <span className={`vital-status-pill vital-status-pill--${featuredProfile.riskLevel}`}>
                      {featuredProfile.trustTier}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h3 className="vital-profile-spotlight__title">{featuredProfile.title}</h3>
                  <p className="vital-profile-spotlight__copy">{featuredProfile.summary}</p>
                </div>
                <div className="vital-chip-list">
                  <span className="vital-chip">{confidenceCopy(featuredProfile.confidence)}</span>
                  <span className="vital-chip">{featuredProfile.evidenceCount} evidence items</span>
                  <span className="vital-chip">{featuredProfile.degree} graph relationships</span>
                </div>
              </div>
              <div className="vital-profile-spotlight__actions">
                <button
                  type="button"
                  className="vital-action-button vital-action-button--full"
                  onClick={() => onRunVerification(featuredProfile.label)}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  <span>Run verification brief</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="vital-empty-state">No provider profiles are visible in this graph slice.</div>
          )}

          <div className="vital-card-grid mt-4">
            {profiles.slice(0, 6).map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="vital-profile-card"
                onClick={() => onSelectProfile(profile.id)}
              >
                <div className="vital-entity-row__meta">
                  <span className="vital-entity-row__title">{profile.title}</span>
                  <span className="vital-entity-row__detail">{profile.summary}</span>
                </div>
                <div className="vital-chip-list">
                  <span className="vital-status-pill">{profile.trustBand ?? 'unscored'}</span>
                  <span className="vital-chip">{confidenceCopy(profile.confidence)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        id="workspace-results"
        className={`vital-intel-section ${activeSection === 'results' ? 'vital-intel-section--active' : ''}`}
      >
        <div className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">Search results</p>
              <h2 className="vital-panel__title">
                {searchTerm.trim().length > 0 ? `Matches for "${searchTerm}"` : 'Current provider slice'}
              </h2>
            </div>
            <Siren className="h-4 w-4 text-[var(--vital-ops-accent-yellow)]" aria-hidden />
          </div>
          <div className="vital-results-table">
            <div className="vital-results-table__head">
              <span>Provider</span>
              <span>Type</span>
              <span>Trust</span>
              <span>Evidence</span>
            </div>
            {searchResults.length === 0 ? (
              <div className="vital-empty-state">No providers match the active workspace search.</div>
            ) : (
              searchResults.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className="vital-results-table__row"
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <span>
                    <strong>{profile.title}</strong>
                    <small>{profile.summary}</small>
                  </span>
                  <span>{formatGraphNodeType(profile.type)}</span>
                  <span>{profile.trustTier ?? profile.trustBand ?? 'review'}</span>
                  <span>{profile.evidenceCount}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
