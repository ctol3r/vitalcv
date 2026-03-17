'use client';

import type {
  ActionsResponse,
  FindingsResponse,
  IntelligenceProvider,
  IntelligenceSystemHealth,
  StorylinesResponse,
  WorkspaceSectionId,
} from '@/lib/intelligence/contracts';
import { WORKSPACE_SECTIONS } from '@/lib/intelligence/layout';
import { ActionCard } from './ActionCard';
import { HealthStatusCard } from './HealthStatusCard';
import { InvestigationPanel } from './InvestigationPanel';
import { ProviderCard } from './ProviderCard';
import { SectionFrame, ToneBadge } from './shared';
import { StorylineCard } from './StorylineCard';
import { FindingsSurface } from '@/components/intelligence-ops/findings-surface';
import { StorylinesSurface } from '@/components/intelligence-ops/storylines-surface';
import { ActionsSurface } from '@/components/intelligence-ops/actions-surface';
import { ProvidersSurface } from '@/components/intelligence-ops/providers-surface';
import { InvestigationsSurface } from '@/components/intelligence-ops/investigations-surface';
import { CalibrationDashboard } from '@/app/calibration/CalibrationDashboard';
import { SystemHealthSurface } from '@/components/intelligence-ops/system-health-surface';
import { GraphPanel } from './GraphPanel';
import type { IntelligenceGraphResponse } from '@/lib/intelligence/contracts';

interface MainWorkspaceProps {
  activeSection: WorkspaceSectionId;
  providers: IntelligenceProvider[];
  selectedProvider: IntelligenceProvider | null;
  comparison: IntelligenceProvider[];
  findings: FindingsResponse | null;
  storylines: StorylinesResponse | null;
  actions: ActionsResponse | null;
  systemHealth: IntelligenceSystemHealth | null;
  loading: {
    providers: boolean;
    findings: boolean;
    storylines: boolean;
    actions: boolean;
    systemHealth: boolean;
  };
  errors: {
    providers: string | null;
    findings: string | null;
    storylines: string | null;
    actions: string | null;
    systemHealth: string | null;
  };
  onNavigate: (section: WorkspaceSectionId) => void;
  onSelectProvider: (providerNpi: string) => void;
  onRefreshProviders: () => void;
  onRefreshInvestigation: () => void;
  onRefreshSystemHealth: () => void;
  graph?: IntelligenceGraphResponse | null;
  graphLoading?: boolean;
}

export function MainWorkspace({
  activeSection,
  providers,
  selectedProvider,
  comparison,
  findings,
  storylines,
  actions,
  systemHealth,
  loading,
  errors,
  onNavigate,
  onSelectProvider,
  onRefreshProviders,
  onRefreshInvestigation,
  onRefreshSystemHealth,
  graph,
  graphLoading,
}: MainWorkspaceProps) {
  const featuredProviders = providers.slice(0, 3);
  const comparisonSet = selectedProvider
    ? [selectedProvider, ...comparison.filter((provider) => provider.id !== selectedProvider.id)].slice(0, 3)
    : comparison;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto pr-1">
      <SectionFrame
        eyebrow="Navigation"
        title="Workspace"
        detail="Switch between dashboard, provider profile, investigation, comparison, and system health views."
      >
        <div className="flex flex-wrap gap-2">
          {WORKSPACE_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onNavigate(section.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                activeSection === section.id
                  ? 'border-cyan-200/20 bg-cyan-200/[0.12] text-cyan-50'
                  : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] hover:bg-[var(--vt-surface-2)]'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </SectionFrame>

      <section
        id="workspace-dashboard"
        className={activeSection === 'dashboard' ? 'scroll-mt-28' : 'hidden'}
      >
        <SectionFrame
          eyebrow="Dashboard"
          title="Dashboard"
          detail="A launch-focused overview of provider readiness, health posture, and the top storyline and action pressure."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ProviderCard
              provider={selectedProvider}
              loading={loading.providers}
              error={errors.providers}
              onSelect={(provider) => {
                onSelectProvider(provider.npi);
                onNavigate('provider-profile');
              }}
              onRetry={onRefreshProviders}
            />
            <div className="grid gap-4">
              {(systemHealth?.cards ?? []).slice(0, 2).map((card) => (
                <HealthStatusCard
                  key={card.id}
                  card={card}
                  loading={loading.systemHealth}
                  error={errors.systemHealth}
                  onRetry={onRefreshSystemHealth}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {featuredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onSelect={() => {
                  onSelectProvider(provider.npi);
                  onNavigate('provider-profile');
                }}
              />
            ))}
          </div>
        </SectionFrame>
      </section>

      <section
        id="workspace-provider-profile"
        className={activeSection === 'provider-profile' ? 'scroll-mt-28' : 'hidden'}
      >
        <SectionFrame
          eyebrow="Provider Profile"
          title="Provider Profile"
          detail="Focused provider surface with direct visibility into storylines and recommended actions."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <ProviderCard
              provider={selectedProvider}
              loading={loading.providers}
              error={errors.providers}
              onSelect={(provider) => onSelectProvider(provider.npi)}
              actionLabel="Refresh provider"
              onRetry={onRefreshProviders}
            />
            <div className="grid gap-4">
              <StorylineCard
                storyline={storylines?.storylines?.[0] ?? null}
                loading={loading.storylines}
                error={errors.storylines}
                onFocusProvider={onSelectProvider}
                onRetry={onRefreshInvestigation}
              />
              <ActionCard
                action={actions?.actions?.[0] ?? null}
                loading={loading.actions}
                error={errors.actions}
                onFocusProvider={onSelectProvider}
                onRetry={onRefreshInvestigation}
              />
            </div>
          </div>
        </SectionFrame>
      </section>

      {/* The old investigation-workspace was removed in favor of the full InvestigationsSurface */}

      <section
        id="workspace-comparison-view"
        className={activeSection === 'comparison-view' ? 'scroll-mt-28' : 'hidden'}
      >
        <SectionFrame
          eyebrow="Comparison"
          title="Comparison View"
          detail="Compare the current provider against the strongest nearby candidates in the current feed."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {(comparisonSet ?? []).map((provider) => (
              <ToneBadge
                key={`compare-chip-${provider.id}`}
                tone={provider.risk}
                label={`${provider.name.split(' ')[0]} • ${provider.trustScore}`}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {comparisonSet.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                loading={loading.providers}
                error={errors.providers}
                onSelect={() => onSelectProvider(provider.npi)}
                actionLabel="Use as focus"
                onRetry={onRefreshProviders}
              />
            ))}
          </div>
        </SectionFrame>
      </section>

      {/* New Consolidated Tabs */}
      <section id="workspace-findings" className={activeSection === 'findings' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'findings' && <FindingsSurface />}
      </section>

      <section id="workspace-storylines" className={activeSection === 'storylines' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'storylines' && <StorylinesSurface />}
      </section>

      <section id="workspace-actions" className={activeSection === 'actions' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'actions' && <ActionsSurface />}
      </section>

      <section id="workspace-providers" className={activeSection === 'providers' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'providers' && <ProvidersSurface />}
      </section>

      <section id="workspace-investigations" className={activeSection === 'investigations' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'investigations' && <InvestigationsSurface />}
      </section>

      <section id="workspace-calibration" className={activeSection === 'calibration' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'calibration' && <CalibrationDashboard />}
      </section>

      <section id="workspace-system-health" className={activeSection === 'system-health' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'system-health' && <SystemHealthSurface />}
      </section>

      <section id="workspace-graph" className={activeSection === 'graph' ? 'scroll-mt-28' : 'hidden'}>
        {activeSection === 'graph' && (
          <GraphPanel
            graph={graph ?? null}
            providers={providers}
            selectedProvider={selectedProvider}
            loading={graphLoading}
            onSelectProvider={(p) => onSelectProvider(p.npi)}
          />
        )}
      </section>
    </div>
  );
}
