'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { OperationsShell } from './shell';
import { EntityLink, OpsBadge, OpsCard, SurfaceBanner, severityTone } from './primitives';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkbenchEvidenceItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
}

interface WorkbenchFindingContext {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  explanation: string;
  confidence: number;
  priorityScore: number;
  evidence: WorkbenchEvidenceItem[];
  actions: Array<{ id: string; label: string; type: string }>;
  relatedFindingIds: string[];
  storylineId: string | null;
  storylineTitle: string | null;
  npis: string[];
  createdAt: string;
}

interface WorkbenchStorylineContext {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  narrative: string;
  whyItMatters: string;
  findingCount: number;
  entityCount: number;
  confidence: number;
  progressionScore: number;
  recommendedActions: string[];
  lastActivityAt: string;
  evidence: WorkbenchEvidenceItem[];
}

interface WorkbenchProviderContext {
  npi: string;
  label: string | null;
  specialty: string | null;
  state: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence: number;
  activeFindings: number;
}

interface WorkbenchRelatedFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  summary: string;
  priorityScore: number;
  href: string;
}

interface WorkbenchNavigation {
  graphHref: string;
  copilotHref: string;
  investigationHref: string;
}

interface WorkbenchContext {
  anchor: { npi?: string; findingId?: string; storylineId?: string };
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  relatedFindings: WorkbenchRelatedFinding[];
  navigation: WorkbenchNavigation | null;
  feedBusStats: { total: number; active: number } | null;
  generatedAt: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceBar(confidence: number) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-yellow-500' :
    'bg-slate-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
    </div>
  );
}

function trustBandTone(band: string): 'success' | 'warning' | 'critical' | 'neutral' {
  switch (band?.toUpperCase()) {
    case 'L3':
    case 'HIGH':
      return 'success';
    case 'L2':
    case 'MEDIUM':
      return 'neutral';
    case 'L1':
    case 'LOW':
      return 'warning';
    case 'L0':
    case 'CRITICAL':
      return 'critical';
    default:
      return 'neutral';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProviderContextCard({ provider, navigation }: {
  provider: WorkbenchProviderContext;
  navigation: WorkbenchNavigation | null;
}) {
  return (
    <OpsCard className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">
            {provider.label ?? `Provider ${provider.npi}`}
          </h3>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--vt-text-3)]">
            {provider.specialty ? <span>{provider.specialty}</span> : null}
            {provider.state ? <span>{provider.state}</span> : null}
            <span>NPI {provider.npi}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <OpsBadge label={provider.trustBand} tone={trustBandTone(provider.trustBand)} />
          <span className="text-xs tabular-nums text-[var(--vt-text-3)]">
            score {provider.trustScore}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--vt-text-3)]">
        <span>{provider.activeFindings} active finding{provider.activeFindings === 1 ? '' : 's'}</span>
        {confidenceBar(provider.trustConfidence)}
      </div>

      <div className="flex flex-wrap gap-2">
        <EntityLink href={`/providers/${provider.npi}`} label="Provider Profile" />
        {navigation?.graphHref ? (
          <EntityLink href={navigation.graphHref} label="Graph" />
        ) : null}
        {navigation?.copilotHref ? (
          <EntityLink href={navigation.copilotHref} label="Copilot" />
        ) : null}
      </div>
    </OpsCard>
  );
}

function FindingContextCard({ finding }: { finding: WorkbenchFindingContext }) {
  return (
    <OpsCard className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Active Finding</span>
        <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
        <OpsBadge label={finding.findingType.replace(/_/g, ' ')} />
      </div>

      <h4 className="text-sm font-semibold text-[var(--vt-text-1)]">{finding.title}</h4>
      <p className="text-sm leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
      <p className="text-sm leading-6 text-[var(--vt-text-3)]">{finding.explanation}</p>

      {finding.evidence.length > 0 ? (
        <div className="space-y-1.5 border-t border-[var(--vt-border)] pt-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--vt-text-3)]">Evidence</p>
          {finding.evidence.slice(0, 4).map((ev, i) => (
            <div key={i} className="flex items-baseline gap-2 text-xs text-[var(--vt-text-3)]">
              <span className="shrink-0 rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-1.5 py-0.5 font-mono text-[10px]">
                {ev.source}
              </span>
              <span className="flex-1 text-[var(--vt-text-2)]">{ev.claim}</span>
              <span className="shrink-0 tabular-nums">{Math.round(ev.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <EntityLink href={`/findings/${finding.id}`} label="Full Finding" />
        {finding.storylineId ? (
          <EntityLink href={`/storylines/${finding.storylineId}`} label={finding.storylineTitle ?? 'View Storyline'} />
        ) : null}
      </div>
    </OpsCard>
  );
}

function StorylineContextCard({ storyline }: { storyline: WorkbenchStorylineContext }) {
  return (
    <OpsCard className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Storyline</span>
        <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
        <OpsBadge label={storyline.status} />
        <span className="text-xs text-[var(--vt-text-3)]">{storyline.storylineType.replace(/_/g, ' ')}</span>
      </div>

      <h4 className="text-sm font-semibold text-[var(--vt-text-1)]">{storyline.title}</h4>
      <p className="text-sm leading-6 text-[var(--vt-text-2)]">{storyline.whyItMatters}</p>

      <div className="flex flex-wrap gap-4 text-xs text-[var(--vt-text-3)]">
        <span>{storyline.findingCount} linked finding{storyline.findingCount === 1 ? '' : 's'}</span>
        <span>{storyline.entityCount} entit{storyline.entityCount === 1 ? 'y' : 'ies'}</span>
        <span>progression {storyline.progressionScore.toFixed(0)}</span>
        {confidenceBar(storyline.confidence)}
      </div>

      {storyline.recommendedActions.length > 0 ? (
        <div className="space-y-1 border-t border-[var(--vt-border)] pt-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--vt-text-3)]">Recommended Actions</p>
          <ul className="space-y-1">
            {storyline.recommendedActions.slice(0, 3).map((action, i) => (
              <li key={i} className="text-xs text-[var(--vt-text-2)]">→ {action}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <EntityLink href={`/storylines/${storyline.id}`} label="View Full Storyline" />
    </OpsCard>
  );
}

// ── Main Surface ──────────────────────────────────────────────────────────────

export function InvestigationsSurface() {
  const searchParams = useSearchParams();
  const seededNpi = searchParams.get('npi') ?? '';
  const seededFindingId = searchParams.get('findingId') ?? '';
  const seededStorylineId = searchParams.get('storylineId') ?? '';

  const [npi, setNpi] = useState(seededNpi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<WorkbenchContext | null>(null);

  const fetchWorkbench = useCallback(async (params: {
    npi?: string;
    findingId?: string;
    storylineId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.npi) qs.set('npi', params.npi);
    if (params.findingId) qs.set('findingId', params.findingId);
    if (params.storylineId) qs.set('storylineId', params.storylineId);
    if (!qs.toString()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/investigation/workbench?${qs.toString()}`);
      const payload = await res.json().catch(() => ({})) as WorkbenchContext;
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error ?? `Request failed ${res.status}`);
      }
      setContext(payload);
      if (params.npi) setNpi(params.npi);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Investigation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load from URL params
  useEffect(() => {
    if (seededNpi || seededFindingId || seededStorylineId) {
      void fetchWorkbench({
        npi: seededNpi || undefined,
        findingId: seededFindingId || undefined,
        storylineId: seededStorylineId || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededNpi, seededFindingId, seededStorylineId]);

  const bannerProvider = context?.provider;

  return (
    <OperationsShell
      activeHref="/investigations"
      title="Investigation Workbench"
      description="Linked-context investigation. Anchor by provider NPI, finding ID, or storyline ID — the workbench resolves full context across trust score, active findings, storyline narrative, and graph."
      breadcrumbs={[{ label: 'Investigations' }]}
      banner={bannerProvider ? (
        <SurfaceBanner tone="info">
          Workbench active for {bannerProvider.label ?? bannerProvider.npi} — trust band{' '}
          <strong>{bannerProvider.trustBand}</strong>, {bannerProvider.activeFindings} active
          finding{bannerProvider.activeFindings === 1 ? '' : 's'}.
        </SurfaceBanner>
      ) : null}
    >
      {/* Input form */}
      <OpsCard className="space-y-3">
        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{10}$/.test(npi.trim())) {
              void fetchWorkbench({ npi: npi.trim() });
            }
          }}
        >
          <input
            value={npi}
            onChange={(e) => setNpi(e.target.value)}
            placeholder="Provider NPI (10 digits)"
            className="min-w-0 flex-1 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-3 text-sm text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)] focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
          <button
            type="submit"
            disabled={loading || !/^\d{10}$/.test(npi.trim())}
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Resolving…' : 'Open Workbench'}
          </button>
        </form>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {/* Deep-link hint from seeded params */}
        {(seededFindingId || seededStorylineId) && !context ? (
          <p className="text-xs text-[var(--vt-text-3)]">
            {seededFindingId ? `Finding ${seededFindingId}` : null}
            {seededStorylineId ? `Storyline ${seededStorylineId}` : null}
            {' — loading context…'}
          </p>
        ) : null}
      </OpsCard>

      {/* Workbench layout */}
      {context ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          {/* Left: main context chain */}
          <div className="space-y-4">
            {context.provider ? (
              <ProviderContextCard provider={context.provider} navigation={context.navigation} />
            ) : null}
            {context.finding ? (
              <FindingContextCard finding={context.finding} />
            ) : null}
            {context.storyline ? (
              <StorylineContextCard storyline={context.storyline} />
            ) : null}

            {/* Empty state */}
            {!context.provider && !context.finding && !context.storyline ? (
              <OpsCard>
                <p className="text-sm text-[var(--vt-text-3)]">
                  No investigation context resolved. Try a different NPI, finding ID, or storyline ID.
                </p>
              </OpsCard>
            ) : null}
          </div>

          {/* Right: related findings */}
          <div className="space-y-3">
            {context.relatedFindings.length > 0 ? (
              <>
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">
                  Related Findings
                </p>
                {context.relatedFindings.map((rf) => (
                  <Link key={rf.id} href={rf.href}>
                    <OpsCard className="cursor-pointer space-y-2 transition hover:border-cyan-400/40">
                      <div className="flex items-center gap-2">
                        <OpsBadge label={rf.severity} tone={severityTone(rf.severity)} />
                        <span className="text-xs text-[var(--vt-text-3)]">
                          {rf.findingType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[var(--vt-text-1)]">{rf.title}</p>
                      <p className="line-clamp-2 text-xs text-[var(--vt-text-3)]">{rf.summary}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--vt-text-3)]">
                          score {rf.priorityScore}
                        </span>
                      </div>
                    </OpsCard>
                  </Link>
                ))}
              </>
            ) : context.provider ? (
              <OpsCard>
                <p className="text-xs text-[var(--vt-text-3)]">No related findings for this provider.</p>
              </OpsCard>
            ) : null}

            {/* Quick nav links */}
            {context.navigation ? (
              <OpsCard className="space-y-2">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">
                  Quick Navigation
                </p>
                <div className="space-y-2">
                  <EntityLink href="/findings" label="All Findings →" />
                  <EntityLink href="/storylines" label="All Storylines →" />
                  {context.navigation.graphHref ? (
                    <EntityLink href={context.navigation.graphHref} label="Graph View →" />
                  ) : null}
                </div>
              </OpsCard>
            ) : null}
          </div>
        </div>
      ) : null}
    </OperationsShell>
  );
}
