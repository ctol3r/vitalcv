'use client';

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type {
  IntelligenceAlert,
  IntelligenceProvider,
  WorkspaceSectionId,
} from '@/lib/intelligence/contracts';
import { buildSourceEntries } from '@/lib/intelligence/contracts';
import { WORKSPACE_SECTIONS } from '@/lib/intelligence/layout';
import { IntelligenceTopNav } from './IntelligenceTopNav';
import { LeftSidebar } from './LeftSidebar';
import { MainWorkspace } from './MainWorkspace';
import { RightPanel } from './RightPanel';

interface CopilotSeed {
  query: string;
  token: number;
}

const VALID_WORKSPACE_SECTIONS = new Set<WorkspaceSectionId>(
  WORKSPACE_SECTIONS.map((section) => section.id),
);

export function IntelligenceConsolePage() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviderNpi, setSelectedProviderNpi] = useState<string | null>(null);
  const [copilotSeed, setCopilotSeed] = useState<CopilotSeed | null>(null);
  const deferredQuery = useDeferredValue(searchTerm);

  const providers = useProviders({
    query: deferredQuery,
    limit: 24,
  });
  const selectedProvider = providers.data?.providers.find((provider) => provider.npi === selectedProviderNpi) ?? null;
  const findings = useFindings({
    provider: selectedProvider?.npi ?? null,
    limit: 8,
  });
  const storylines = useStorylines({
    provider: selectedProvider?.npi ?? null,
    limit: 6,
  });
  const actions = useActions({
    entity: selectedProvider?.npi ?? null,
    limit: 8,
  });
  const systemHealth = useSystemHealth();
  const graph = useGraph({
    npi: selectedProvider?.npi ?? null,
    layer: 'blended',
    limit: 240,
  });

  const refreshAll = useCallback(() => {
    providers.refresh();
    findings.refresh();
    storylines.refresh();
    actions.refresh();
    systemHealth.refresh();
    graph.refresh();
  }, [actions, findings, graph, providers, storylines, systemHealth]);

  const lastUpdatedSignature = useMemo(
    () => [
      providers.lastUpdated,
      findings.lastUpdated,
      storylines.lastUpdated,
      actions.lastUpdated,
      systemHealth.lastUpdated,
      graph.lastUpdated,
    ].filter(Boolean).join('|'),
    [
      actions.lastUpdated,
      findings.lastUpdated,
      graph.lastUpdated,
      providers.lastUpdated,
      storylines.lastUpdated,
      systemHealth.lastUpdated,
    ],
  );

  useEffect(() => {
    const seededQuery = searchParams.get('q') ?? '';
    const seededNpi = searchParams.get('npi');
    const seededView = searchParams.get('view');
    const seededCopilot = searchParams.get('copilot') ?? '';
    const nextSection = (
      seededView && VALID_WORKSPACE_SECTIONS.has(seededView as WorkspaceSectionId)
        ? seededView as WorkspaceSectionId
        : null
    );

    if (seededNpi && /^\d{10}$/.test(seededNpi)) {
      startTransition(() => {
        setSearchTerm(seededNpi);
        setSelectedProviderNpi(seededNpi);
        setActiveSection(nextSection ?? 'provider-profile');
      });
    } else if (nextSection) {
      startTransition(() => {
        setActiveSection(nextSection);
      });
    }

    if (seededQuery) {
      startTransition(() => {
        setSearchTerm(seededQuery);
      });
    }

    if (seededCopilot.trim().length > 0) {
      startTransition(() => {
        setCopilotSeed({
          query: seededCopilot.trim(),
          token: Date.now(),
        });
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const firstProvider = providers.data?.providers[0] ?? null;

    if (!firstProvider) {
      setSelectedProviderNpi(null);
      return;
    }

    const selectionStillVisible = providers.data?.providers.some((provider) => provider.npi === selectedProviderNpi);
    if (selectionStillVisible) {
      return;
    }

    setSelectedProviderNpi(firstProvider.npi);
  }, [providers.data?.providers, selectedProviderNpi]);

  useEffect(() => {
    const handleRefresh = () => {
      refreshAll();
    };

    window.addEventListener('vital:intelligence:refresh', handleRefresh);
    return () => window.removeEventListener('vital:intelligence:refresh', handleRefresh);
  }, [refreshAll]);

  const sourceEntries = buildSourceEntries({
    provider: selectedProvider,
    findings: findings.data?.findings ?? [],
    storylines: storylines.data?.storylines ?? [],
    actions: actions.data?.actions ?? [],
  });

  const sidebarAlerts: IntelligenceAlert[] = [
    ...(findings.data?.alerts ?? []),
    ...(systemHealth.data?.incidents ?? []),
  ].slice(0, 8);

  function selectProvider(providerNpi: string) {
    startTransition(() => {
      setSelectedProviderNpi(providerNpi);
      setActiveSection('provider-profile');
    });
  }

  function selectProviderRecord(provider: IntelligenceProvider) {
    selectProvider(provider.npi);
  }

  return (
    <AppShell
      topNav={(
        <IntelligenceTopNav
          overallHealth={systemHealth.data?.overall ?? 'neutral'}
          focusLabel={selectedProvider ? `${selectedProvider.name} in scope` : 'Global scope'}
          graphStats={graph.data?.stats ?? null}
          providerCount={providers.data?.total ?? 0}
          findingCount={findings.data?.total ?? 0}
          storylineCount={storylines.data?.total ?? 0}
          actionCount={actions.data?.total ?? 0}
          lastUpdatedSignature={lastUpdatedSignature}
          onRefreshAll={refreshAll}
        />
      )}
      sidebar={(
        <LeftSidebar
          activeSection={activeSection}
          alerts={sidebarAlerts}
          resultCount={providers.data?.total ?? 0}
          searchTerm={searchTerm}
          watchlist={providers.data?.watchlist ?? []}
          onNavigate={(section) => {
            startTransition(() => {
              setActiveSection(section);
            });
          }}
          onSearchChange={(value) => {
            startTransition(() => {
              setSearchTerm(value);
            });
          }}
          onSelectProvider={selectProvider}
        />
      )}
      context={(
        <RightPanel
          providers={providers.data?.providers ?? []}
          selectedProvider={selectedProvider}
          graph={graph.data}
          graphLoading={graph.loading}
          graphError={graph.error}
          systemHealth={systemHealth.data}
          systemHealthLoading={systemHealth.loading}
          systemHealthError={systemHealth.error}
          copilotSeed={copilotSeed}
          sources={sourceEntries}
          alerts={sidebarAlerts}
          onSelectProvider={selectProviderRecord}
          onRefreshGraph={graph.refresh}
          onRefreshSystemHealth={systemHealth.refresh}
        />
      )}
    >
      <MainWorkspace
        activeSection={activeSection}
        providers={providers.data?.providers ?? []}
        selectedProvider={selectedProvider}
        comparison={providers.data?.comparison ?? []}
        findings={findings.data}
        storylines={storylines.data}
        actions={actions.data}
        systemHealth={systemHealth.data}
        loading={{
          providers: providers.loading,
          findings: findings.loading,
          storylines: storylines.loading,
          actions: actions.loading,
          systemHealth: systemHealth.loading,
        }}
        errors={{
          providers: providers.error,
          findings: findings.error,
          storylines: storylines.error,
          actions: actions.error,
          systemHealth: systemHealth.error,
        }}
        onNavigate={(section) => {
          startTransition(() => {
            setActiveSection(section);
          });
        }}
        onSelectProvider={selectProvider}
        onRefreshProviders={providers.refresh}
        onRefreshInvestigation={() => {
          findings.refresh();
          storylines.refresh();
          actions.refresh();
        }}
        onRefreshSystemHealth={systemHealth.refresh}
      />
    </AppShell>
  );
}
