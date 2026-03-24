'use client';

import type React from 'react';
import dynamic from 'next/dynamic';
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

// GlobalMapWorkspace uses react-simple-maps which requires SSR disabled
const GlobalMapWorkspace = dynamic(
  () => import('./GlobalMapWorkspace').then(m => ({ default: m.GlobalMapWorkspace })),
  { ssr: false, loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-white/30">
      Loading map…
    </div>
  )},
);

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
  mapSearchQuery?: string;
  onRefreshProviders: () => void;
  onRefreshInvestigation: () => void;
  onRefreshSystemHealth: () => void;
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
  mapSearchQuery = '',
  onRefreshProviders,
  onRefreshInvestigation,
  onRefreshSystemHealth,
}: MainWorkspaceProps) {
  const featuredProviders = providers.slice(0, 3);
  const comparisonSet = selectedProvider
    ? [selectedProvider, ...comparison.filter((provider) => provider.id !== selectedProvider.id)].slice(0, 3)
    : comparison;

  let workspaceContent: React.ReactNode;

  switch (activeSection) {
    case 'provider-profile':
      workspaceContent = (
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
      );
      break;
    case 'investigations':
      workspaceContent = (
        <InvestigationPanel
          provider={selectedProvider}
          findings={findings?.findings ?? []}
          storylines={storylines?.storylines ?? []}
          actions={actions?.actions ?? []}
          loading={loading.findings || loading.storylines || loading.actions}
          error={errors.findings ?? errors.storylines ?? errors.actions}
          onFocusProvider={onSelectProvider}
          onRetry={onRefreshInvestigation}
        />
      );
      break;
    case 'comparison-view':
      workspaceContent = (
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
      );
      break;
    case 'map':
      workspaceContent = (
        <div className="h-full min-h-[540px]">
          <GlobalMapWorkspace
            onSelectProvider={onSelectProvider}
            searchQuery={mapSearchQuery}
          />
        </div>
      );
      break;
    case 'dashboard':
    default:
      workspaceContent = (
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
      );
      break;
  }

  return (
    <div className="vital-workspace-scroll">
      <SectionFrame
        eyebrow="Navigation"
        title="Workspace"
        detail="Switch between dashboard, provider profile, investigation, and comparison without losing provider scope."
        className="vital-workspace-hero"
      >
        <div className="flex flex-wrap gap-2">
          {WORKSPACE_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-pressed={activeSection === section.id}
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

      <div key={activeSection} className="vital-workspace-panel vital-intel-section vital-intel-section--active">
        {workspaceContent}
      </div>
    </div>
  );
}
