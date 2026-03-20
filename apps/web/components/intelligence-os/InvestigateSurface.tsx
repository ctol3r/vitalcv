'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { CanvasDecisionBlock } from '@/components/intelligence-ops/canvas-decision-block';
import {
  removeCanvasOpenPanel,
  toggleCompareSelection,
  type CanvasOpenPanel,
} from '@/lib/intelligence/canvas';
import type { WorkspaceState } from '@/lib/intelligence/workspace-store';
import { formatRelativeTime } from '@/lib/intelligence/time';

type InvestigateTab = 'signals' | 'cases' | 'evidence';

interface CompareResponse {
  comparison?: {
    ranking?: Array<{ npi: string; score: number; band: string }>;
    commonGaps?: string[];
    strengthDelta?: Array<{ dimension: string; spread: number; leader: string }>;
  };
  recommendations?: string[];
}

function TrustBand({ score }: { score: number }) {
  const color =
    score >= 85 ? 'text-emerald-400'
    : score >= 65 ? 'text-amber-400'
    : 'text-red-400';

  return <span className={`font-mono font-bold ${color}`}>{score}</span>;
}

function Backlink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2.5 py-1 text-[10px] text-[var(--vt-text-3)] transition hover:border-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]"
    >
      {label}
      <ExternalLink className="h-2.5 w-2.5" />
    </button>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition ${
        active
          ? 'border-cyan-400 text-cyan-300'
          : 'border-transparent text-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono ${
        active ? 'bg-cyan-400/20 text-cyan-300' : 'bg-[var(--vt-surface-2)] text-[var(--vt-text-3)]'
      }`}>
        {count}
      </span>
    </button>
  );
}

interface InvestigateSurfaceProps {
  state: WorkspaceState;
  onNavigate: (next: Partial<WorkspaceState>) => void;
  onBack: () => void;
}

export function InvestigateSurface({ state, onNavigate, onBack }: InvestigateSurfaceProps) {
  const [activeTab, setActiveTab] = useState<InvestigateTab>(
    state.storylineId ? 'cases' : 'signals',
  );
  const [comparePayload, setComparePayload] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const npi = state.npi ?? '';
  const providers = useProviders({ limit: 20 });
  const findings = useFindings({ provider: npi, limit: 50, pollIntervalMs: 30_000 });
  const storylines = useStorylines({ provider: npi, limit: 20, pollIntervalMs: 60_000 });
  const actions = useActions({ entity: npi || undefined, limit: 12, pollIntervalMs: 60_000 });

  const provider = useMemo(
    () => (providers.data?.providers ?? []).find((p) => p.npi === npi) ?? null,
    [providers.data, npi],
  );
  const selectedFinding = useMemo(
    () => (findings.data?.findings ?? []).find((finding) => finding.id === state.findingId) ?? null,
    [findings.data?.findings, state.findingId],
  );
  const selectedStoryline = useMemo(
    () => (storylines.data?.storylines ?? []).find((storyline) => storyline.id === state.storylineId)
      ?? (selectedFinding?.storylineId
        ? (storylines.data?.storylines ?? []).find((storyline) => storyline.id === selectedFinding.storylineId) ?? null
        : null),
    [selectedFinding?.storylineId, state.storylineId, storylines.data?.storylines],
  );

  const allFindings = findings.data?.findings ?? [];
  const allStorylines = storylines.data?.storylines ?? [];
  const allEvidence = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      label: string;
      snippet: string | null;
      source: string | null;
      observedAt: string | null;
      fromTitle: string;
    }> = [];

    for (const finding of allFindings) {
      for (const evidence of finding.evidence ?? []) {
        const key = `${evidence.label}:${evidence.snippet}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        out.push({
          id: `${finding.id}:${evidence.label}`,
          label: evidence.label,
          snippet: evidence.snippet ?? null,
          source: evidence.source ?? null,
          observedAt: evidence.observedAt ?? null,
          fromTitle: finding.title,
        });
      }
    }

    return out;
  }, [allFindings]);

  const compareNpis = state.compareNpis;
  const canvasOpenPanels = useMemo(
    () => state.openPanels.filter((panel): panel is CanvasOpenPanel => (
      panel === 'provider' || panel === 'finding' || panel === 'storyline'
    )),
    [state.openPanels],
  );

  useEffect(() => {
    if (compareNpis.length < 2) {
      setComparePayload(null);
      setCompareError(null);
      setCompareLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadComparison() {
      setCompareLoading(true);
      setCompareError(null);

      try {
        const response = await fetch('/api/investigation/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npis: compareNpis }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null) as CompareResponse | null;
        if (!response.ok || !payload) {
          throw new Error('Comparison unavailable.');
        }

        if (!controller.signal.aborted) {
          setComparePayload(payload);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setCompareError(error instanceof Error ? error.message : 'Comparison unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setCompareLoading(false);
        }
      }
    }

    void loadComparison();
    return () => controller.abort();
  }, [compareNpis]);

  const compareProviders = useMemo(
    () => compareNpis
      .map((compareNpi) => (providers.data?.providers ?? []).find((candidate) => candidate.npi === compareNpi) ?? null)
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)),
    [compareNpis, providers.data?.providers],
  );

  function setOpenPanels(openPanels: CanvasOpenPanel[]) {
    onNavigate({ openPanels });
  }

  function closePanel(panel: CanvasOpenPanel) {
    setOpenPanels(removeCanvasOpenPanel(canvasOpenPanels, panel));
  }

  const loadingProvider = providers.loading && !provider;
  const providerRecommendations = (actions.data?.actions ?? [])
    .filter((action) => action.providerNpi === provider?.npi)
    .slice(0, 3)
    .map((action) => action.title);
  const findingRecommendations = (actions.data?.actions ?? [])
    .filter((action) => action.sourceFindingIds.includes(selectedFinding?.id ?? ''))
    .slice(0, 3)
    .map((action) => action.title);

  return (
    <div className="grid h-full min-h-0 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-h-0 flex-col border-r border-[var(--vt-border)] bg-[var(--vt-bg)]/45 backdrop-blur-sm">
        <div className="shrink-0 border-b border-[var(--vt-border)] bg-[var(--vt-surface)]">
          <div className="flex items-center gap-3 px-5 py-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Monitor
            </button>
            <span className="text-[var(--vt-border)]">/</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Investigate
            </span>
          </div>

          {loadingProvider ? (
            <div className="animate-pulse space-y-2 px-5 pb-4">
              <div className="h-5 w-48 rounded bg-[var(--vt-surface-2)]" />
              <div className="h-3 w-32 rounded bg-[var(--vt-surface-2)]" />
            </div>
          ) : provider ? (
            <div className="px-5 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">{provider.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--vt-text-3)]">
                    <span className="font-mono">NPI {provider.npi}</span>
                    <span>{provider.specialties.slice(0, 2).join(' · ')}</span>
                    <span className={`uppercase font-semibold ${
                      provider.credentialHealth === 'VERIFIED'
                        ? 'text-emerald-400'
                        : provider.credentialHealth === 'REVOKED'
                          ? 'text-red-400'
                          : 'text-amber-400'
                    }`}>
                      {provider.credentialHealth}
                    </span>
                  </div>
                  {provider.summary ? (
                    <p className="max-w-2xl line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)]">
                      {provider.summary}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 space-y-1 text-right">
                  <div className="text-xs text-[var(--vt-text-3)]">Trust Score</div>
                  <div className="text-3xl font-bold tabular-nums">
                    <TrustBand score={provider.trustScore} />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">/ 100</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Backlink label="Signals" onClick={() => setActiveTab('signals')} />
                <Backlink label="Cases" onClick={() => setActiveTab('cases')} />
                <Backlink label="Evidence" onClick={() => setActiveTab('evidence')} />
                <Backlink
                  label={compareNpis.length > 1 ? `Compare ${compareNpis.length}` : 'Start compare'}
                  onClick={() => onNavigate({
                    compareNpis: state.compareNpis.length === 0
                      ? [provider.npi]
                      : toggleCompareSelection(state.compareNpis, provider.npi),
                    openPanels: state.openPanels.includes('provider') ? state.openPanels : [...state.openPanels, 'provider'],
                  })}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(['provider', 'finding', 'storyline'] as CanvasOpenPanel[]).map((panel) => {
                  const disabled = (panel === 'finding' && !selectedFinding) || (panel === 'storyline' && !selectedStoryline);
                  return (
                    <button
                      key={panel}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled || state.openPanels.includes(panel)) {
                          return;
                        }
                        onNavigate({ openPanels: [...state.openPanels, panel] });
                      }}
                      className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                        state.openPanels.includes(panel)
                          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                          : disabled
                            ? 'cursor-not-allowed border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-3)] opacity-50'
                            : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)]'
                      }`}
                    >
                      {panel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-5 pb-4">
              <p className="text-sm text-[var(--vt-text-3)]">NPI {npi || 'unknown'}</p>
            </div>
          )}

          <div className="flex border-t border-[var(--vt-border)]">
            <TabButton label="Signals" count={allFindings.length} active={activeTab === 'signals'} onClick={() => setActiveTab('signals')} />
            <TabButton label="Cases" count={allStorylines.length} active={activeTab === 'cases'} onClick={() => setActiveTab('cases')} />
            <TabButton label="Evidence" count={allEvidence.length} active={activeTab === 'evidence'} onClick={() => setActiveTab('evidence')} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'signals' && (
            findings.loading && allFindings.length === 0 ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-[3px] bg-[var(--vt-surface)]" style={{ animationDelay: `${i * 60}ms` }} />
              ))
            ) : allFindings.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--vt-text-3)]">No signals for this entity.</p>
            ) : allFindings.map((finding) => (
              <div
                key={finding.id}
                className={`cursor-pointer space-y-2 rounded-[3px] border bg-[var(--vt-surface)] p-4 transition hover:border-[var(--vt-text-3)] ${
                  state.findingId === finding.id ? 'ring-1 ring-inset ring-cyan-400/40' : 'border-[var(--vt-border)]'
                }`}
                onClick={() => onNavigate({
                  findingId: finding.id,
                  storylineId: finding.storylineId,
                  openPanels: finding.storylineId ? ['provider', 'finding', 'storyline'] : ['provider', 'finding'],
                })}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[2px] border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-cyan-300">
                    SIGNAL
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${
                    finding.severity === 'critical'
                      ? 'text-red-400'
                      : finding.severity === 'high'
                        ? 'text-amber-400'
                        : 'text-[var(--vt-text-3)]'
                  }`}>
                    {finding.severity}
                  </span>
                  <span className="ml-auto text-[10px] text-[var(--vt-text-3)]">{formatRelativeTime(finding.updatedAt)}</span>
                </div>
                <p className="text-sm font-medium text-[var(--vt-text-1)]">{finding.title}</p>
                <p className="line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)]">{finding.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {finding.storylineId ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveTab('cases');
                        onNavigate({ storylineId: finding.storylineId, openPanels: ['provider', 'finding', 'storyline'] });
                      }}
                      className="text-[10px] text-violet-400 transition hover:text-violet-300"
                    >
                      ↗ {finding.storylineTitle ?? 'Open case'}
                    </button>
                  ) : null}
                  {finding.evidence.length > 0 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveTab('evidence');
                      }}
                      className="text-[10px] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
                    >
                      {finding.evidence.length} evidence items ↗
                    </button>
                  ) : null}
                  <span className="ml-auto font-mono text-[10px] text-[var(--vt-text-3)]">
                    CONF {Math.round(finding.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))
          )}

          {activeTab === 'cases' && (
            storylines.loading && allStorylines.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-[3px] bg-[var(--vt-surface)]" style={{ animationDelay: `${i * 60}ms` }} />
              ))
            ) : allStorylines.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--vt-text-3)]">No active cases for this entity.</p>
            ) : allStorylines.map((storyline) => (
              <div
                key={storyline.id}
                className={`cursor-pointer space-y-2 rounded-[3px] border bg-[var(--vt-surface)] p-4 transition hover:border-[var(--vt-text-3)] ${
                  state.storylineId === storyline.id ? 'ring-1 ring-inset ring-violet-400/40' : 'border-[var(--vt-border)]'
                }`}
                onClick={() => onNavigate({ storylineId: storyline.id, openPanels: ['provider', 'storyline'] })}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[2px] border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-violet-300">
                    CASE
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">
                    {storyline.storylineType.replace(/_/g, ' ')}
                  </span>
                  <span className="ml-auto text-[10px] text-[var(--vt-text-3)]">{formatRelativeTime(storyline.lastActivityAt)}</span>
                </div>
                <p className="text-sm font-medium text-[var(--vt-text-1)]">{storyline.title}</p>
                <p className="line-clamp-2 text-xs leading-5 text-[var(--vt-text-2)]">{storyline.whyItMatters || storyline.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-[var(--vt-text-3)]">{storyline.findingIds.length} signals linked</span>
                  {storyline.recommendedActions.length > 0 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNavigate({ mode: 'decide', storylineId: storyline.id, openPanels: ['storyline'] });
                      }}
                      className="text-[10px] text-emerald-400 transition hover:text-emerald-300"
                    >
                      ↗ {storyline.recommendedActions.length} recommended action{storyline.recommendedActions.length !== 1 ? 's' : ''}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}

          {activeTab === 'evidence' && (
            allEvidence.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--vt-text-3)]">No evidence collected yet.</p>
            ) : allEvidence.map((evidence) => (
              <div
                key={evidence.id}
                className="space-y-2 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[2px] border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-300">
                    EVIDENCE
                  </span>
                  {evidence.source ? <span className="text-[10px] text-[var(--vt-text-3)]">{evidence.source}</span> : null}
                  {evidence.observedAt ? (
                    <span className="ml-auto text-[10px] text-[var(--vt-text-3)]">{formatRelativeTime(evidence.observedAt)}</span>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-[var(--vt-text-1)]">{evidence.label}</p>
                {evidence.snippet ? (
                  <p className="line-clamp-3 text-xs leading-5 text-[var(--vt-text-2)]">{evidence.snippet}</p>
                ) : null}
                <p className="text-[10px] text-[var(--vt-text-3)]">
                  ↗ from: <span className="text-[var(--vt-text-2)]">{evidence.fromTitle}</span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto border-l border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4">
        <div className="space-y-4">
          {compareNpis.length > 0 ? (
            <CanvasDecisionBlock
              eyebrow="Compare"
              title={compareProviders.length > 1 ? `${compareProviders.length} provider comparison` : 'Compare mode'}
              summary={compareProviders.length > 1
                ? 'Compare mode stays pinned while you move through signals and cases.'
                : 'Add another provider from monitor or the command palette to complete the comparison.'}
              badgeLabel={compareProviders.length > 1 ? 'live' : 'seeded'}
              badgeTone={compareProviders.length > 1 ? 'success' : 'info'}
              recommendations={comparePayload?.recommendations ?? []}
              secondaryActions={[
                {
                  label: 'Clear compare',
                  onClick: () => onNavigate({ compareNpis: [] }),
                },
              ]}
              onClose={() => onNavigate({ compareNpis: [] })}
            >
              <div className="grid gap-2">
                {compareProviders.map((compareProvider) => (
                  <div
                    key={compareProvider.npi}
                    className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--vt-text-1)]">{compareProvider.name}</p>
                        <p className="mt-1 text-xs text-[var(--vt-text-3)]">NPI {compareProvider.npi}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate({ compareNpis: toggleCompareSelection(state.compareNpis, compareProvider.npi) })}
                        className="rounded-full border border-[var(--vt-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Trust</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">{compareProvider.trustScore}</p>
                      </div>
                      <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Credentials</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">
                          {compareProvider.activeCredentials}/{compareProvider.credentialCount}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {comparePayload?.comparison?.strengthDelta?.length ? (
                <div className="mt-4 space-y-2">
                  {comparePayload.comparison.strengthDelta.map((entry) => (
                    <p
                      key={`${entry.dimension}:${entry.leader}`}
                      className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-sm text-[var(--vt-text-2)]"
                    >
                      {entry.dimension} favors {entry.leader} by {Math.round(entry.spread)}
                    </p>
                  ))}
                </div>
              ) : null}

              {compareLoading ? <p className="mt-4 text-sm text-[var(--vt-text-3)]">Loading compare deltas…</p> : null}
              {!compareLoading && compareError ? <p className="mt-4 text-sm text-amber-200">{compareError}</p> : null}
            </CanvasDecisionBlock>
          ) : null}

          {state.openPanels.includes('provider') && provider ? (
            <CanvasDecisionBlock
              eyebrow="Provider"
              title={provider.name}
              summary={provider.summary}
              badgeLabel={`Trust ${provider.trustScore}`}
              badgeTone="info"
              metrics={[
                { label: 'Trust', value: String(provider.trustScore) },
                { label: 'Credentials', value: `${provider.activeCredentials}/${provider.credentialCount}` },
                { label: 'Signals', value: String(allFindings.length) },
                { label: 'Cases', value: String(allStorylines.length) },
              ]}
              recommendations={providerRecommendations}
              backlinks={[
                { label: `${allFindings.length} signals`, onClick: () => setActiveTab('signals') },
                { label: `${allStorylines.length} cases`, onClick: () => setActiveTab('cases') },
                { label: 'Decide', onClick: () => onNavigate({ mode: 'decide' }) },
              ]}
              primaryAction={{
                label: state.compareNpis.includes(provider.npi) ? 'Remove compare' : 'Add compare',
                onClick: () => onNavigate({
                  compareNpis: state.compareNpis.length === 0
                    ? [provider.npi]
                    : toggleCompareSelection(state.compareNpis, provider.npi),
                }),
                tone: 'primary',
              }}
              secondaryActions={[
                { label: 'View evidence', onClick: () => setActiveTab('evidence') },
              ]}
              onClose={() => closePanel('provider')}
            />
          ) : null}

          {state.openPanels.includes('finding') && selectedFinding ? (
            <CanvasDecisionBlock
              eyebrow="Finding"
              title={selectedFinding.title}
              summary={selectedFinding.explanation || selectedFinding.summary}
              badgeLabel={selectedFinding.severity}
              badgeTone={selectedFinding.severity === 'critical' ? 'critical' : selectedFinding.severity === 'high' ? 'warning' : 'info'}
              metrics={[
                { label: 'Priority', value: String(Math.round(selectedFinding.priorityScore)) },
                { label: 'Confidence', value: `${Math.round(selectedFinding.confidence * 100)}%` },
                { label: 'Evidence', value: String(selectedFinding.evidence.length) },
                { label: 'Updated', value: formatRelativeTime(selectedFinding.updatedAt) },
              ]}
              recommendations={findingRecommendations}
              backlinks={[
                ...(selectedFinding.storylineId && selectedStoryline
                  ? [{ label: selectedStoryline.title, onClick: () => onNavigate({ storylineId: selectedStoryline.id, openPanels: ['provider', 'finding', 'storyline'] }) }]
                  : []),
                { label: 'Evidence lane', onClick: () => setActiveTab('evidence') },
              ]}
              primaryAction={{
                label: 'Escalate to decide',
                onClick: () => onNavigate({ mode: 'decide', findingId: selectedFinding.id, openPanels: ['finding', 'storyline'] }),
                tone: 'primary',
              }}
              secondaryActions={[
                { label: 'Signals tab', onClick: () => setActiveTab('signals') },
              ]}
              onClose={() => closePanel('finding')}
            />
          ) : null}

          {state.openPanels.includes('storyline') && selectedStoryline ? (
            <CanvasDecisionBlock
              eyebrow="Storyline"
              title={selectedStoryline.title}
              summary={selectedStoryline.whyItMatters || selectedStoryline.summary}
              badgeLabel={selectedStoryline.status}
              badgeTone="info"
              metrics={[
                { label: 'Findings', value: String(selectedStoryline.findingIds.length) },
                { label: 'Confidence', value: `${Math.round(selectedStoryline.confidence * 100)}%` },
                { label: 'Progression', value: `${Math.round(selectedStoryline.progressionScore * 100)}%` },
                { label: 'Updated', value: formatRelativeTime(selectedStoryline.lastActivityAt) },
              ]}
              recommendations={selectedStoryline.recommendedActions.slice(0, 3)}
              backlinks={allFindings
                .filter((finding) => selectedStoryline.findingIds.includes(finding.id))
                .slice(0, 3)
                .map((finding) => ({
                  label: finding.title,
                  onClick: () => onNavigate({ findingId: finding.id, storylineId: selectedStoryline.id, openPanels: ['provider', 'finding', 'storyline'] }),
                }))}
              primaryAction={{
                label: 'Move to decide',
                onClick: () => onNavigate({ mode: 'decide', storylineId: selectedStoryline.id, openPanels: ['storyline'] }),
                tone: 'primary',
              }}
              secondaryActions={[
                { label: 'Cases tab', onClick: () => setActiveTab('cases') },
              ]}
              onClose={() => closePanel('storyline')}
            />
          ) : null}

          {state.openPanels.length === 0 && compareNpis.length === 0 ? (
            <CanvasDecisionBlock
              eyebrow="Panels"
              title="Open parallel context"
              summary="Provider, finding, storyline, and compare panels can stay open together while the graph remains mounted behind the workspace."
              secondaryActions={[
                { label: 'Provider panel', onClick: () => onNavigate({ openPanels: ['provider'] }) },
                ...(selectedFinding ? [{ label: 'Finding panel', onClick: () => onNavigate({ openPanels: ['provider', 'finding'] }) }] : []),
                ...(selectedStoryline ? [{ label: 'Storyline panel', onClick: () => onNavigate({ openPanels: ['provider', 'storyline'] }) }] : []),
              ]}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
