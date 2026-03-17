'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import { useProviders } from '@/hooks/useProviders';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import {
  hasFindingFilters,
  parseFindingFilters,
  parseMinConfidenceNumber,
  serializeFindingFilters,
} from '@/lib/intelligence/finding-filters';
import {
  formatLastRefreshMessage,
  getFindingsEmptyState,
  getSurfaceFreshnessState,
  hasDegradedDataSources,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { FindingFilters } from './finding-filters';
import { OperationsShell } from './shell';
import {
  BadgeLink,
  ConfidenceMeter,
  EntityLink,
  OpsCard,
  OpsCardSkeleton,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  TimestampPair,
} from './primitives';
import { FindingMutationControls } from './mutation-controls';
import { formatPaginationSummary, Pagination } from './pagination';
import { FindingCard } from '@/src/ui/components';

const PAGE_SIZE = 10;

export function FindingsSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const searchQuery = searchParams.toString();
  const providerScope = searchParams.get('provider') ?? searchParams.get('providerId');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = useMemo(() => parseFindingFilters(searchParams), [searchQuery]);
  const hasFilters = hasFindingFilters(filters) || Boolean(providerScope);

  const findings = useFindings({
    provider: providerScope,
    severity: filters.severity,
    status: filters.status,
    type: filters.type,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    minConfidence: parseMinConfidenceNumber(filters.minConfidence),
    page,
    limit: PAGE_SIZE,
  });
  const providers = useProviders({
    page: 1,
    limit: 1,
    paused: hasFilters,
  });
  const systemHealth = useSystemHealth();

  const currentHref = useMemo(() => {
    return `${pathname}${searchQuery ? `?${searchQuery}` : ''}`;
  }, [pathname, searchQuery]);

  function pushWithParams(nextFilters = filters, nextPage = 1) {
    const params = serializeFindingFilters(nextFilters, { page: nextPage });
    if (providerScope) {
      params.set('provider', providerScope);
    }
    const href = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    if (href === currentHref) {
      findings.refresh();
      return;
    }

    startTransition(() => {
      router.push(href);
    });
  }

  // ── Ranking / sort mode ────────────────────────────────────────────────
  type FeedSortMode = 'ranked' | 'latest' | 'critical';
  const [sortMode, setSortMode] = useState<FeedSortMode>('ranked');

  const totalPages = findings.data?.pageInfo?.totalPages ?? 1;
  const total = findings.data?.total ?? 0;
  const rawItems = findings.data?.findings ?? [];

  const items = useMemo(() => {
    if (sortMode === 'latest') {
      return [...rawItems].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    if (sortMode === 'critical') {
      return [...rawItems].filter(f => f.severity === 'critical' || f.severity === 'high');
    }
    // ranked: composite score = 0.3*priority + 0.3*severity + 0.2*recency + 0.2*confidence
    const severityWeight: Record<string, number> = { critical: 1, high: 0.75, medium: 0.5, low: 0.25, info: 0.1 };
    const now = Date.now();
    return [...rawItems].sort((a, b) => {
      const recencyA = Math.max(0, 1 - (now - new Date(a.updatedAt).getTime()) / (7 * 86400000));
      const recencyB = Math.max(0, 1 - (now - new Date(b.updatedAt).getTime()) / (7 * 86400000));
      const scoreA = 0.3 * (a.priorityScore / 100) + 0.3 * (severityWeight[a.severity] ?? 0.3) + 0.2 * recencyA + 0.2 * a.confidence;
      const scoreB = 0.3 * (b.priorityScore / 100) + 0.3 * (severityWeight[b.severity] ?? 0.3) + 0.2 * recencyB + 0.2 * b.confidence;
      return scoreB - scoreA;
    });
  }, [rawItems, sortMode]);
  const staleState = getSurfaceFreshnessState({
    generatedAt: findings.data?.generatedAt,
    lastUpdated: findings.lastUpdated,
  });
  const emptyState = !findings.loading && !findings.error
    ? getFindingsEmptyState({
      findingCount: findings.data?.total ?? items.length,
      hasFilters,
      providerCount: providers.data?.total,
    })
    : null;
  const degradedSources = hasDegradedDataSources(systemHealth.data);

  return (
    <OperationsShell
      activeHref="/findings"
      title="Findings"
      description="Operational investigator findings with real filters, pagination, triage actions, and detail links into the underlying evidence."
      breadcrumbs={[{ label: 'Findings' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Feed health</p>
          <p>{findings.data?.total ?? 0} total findings</p>
          {findings.lastUpdated ? (
            <p title={formatAbsoluteTime(findings.lastUpdated)}>Updated {formatRelativeTime(findings.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={findings.refresh}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
      banner={(
        <>
          {findings.recovering && findings.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful finding snapshot while the data plane recovers.
            </SurfaceBanner>
          ) : null}
          {degradedSources ? (
            <SurfaceBanner tone="warning">
              Some data sources are degraded. Findings may be incomplete.
            </SurfaceBanner>
          ) : null}
          {staleState.isStale && staleState.ageMinutes !== null ? (
            <SurfaceBanner tone="info">
              {formatLastRefreshMessage(staleState.ageMinutes)}
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      <FindingFilters filters={filters} onApply={(nextFilters) => pushWithParams(nextFilters, 1)} />

      {/* Sort mode toggles */}
      <div className="flex items-center gap-1.5">
        {(['ranked', 'latest', 'critical'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              sortMode === mode
                ? 'border-cyan-400/50 bg-cyan-400/10 text-[var(--vt-text-1)]'
                : 'border-[var(--vt-border)] text-[var(--vt-text-3)] hover:border-[var(--vt-text-3)]/40'
            }`}
          >
            {mode === 'ranked' ? 'Ranked' : mode === 'latest' ? 'Latest' : 'Critical'}
          </button>
        ))}
        <span className="ml-2 text-[10px] text-[var(--vt-text-3)]">
          {sortMode === 'ranked' ? 'Priority + Severity + Recency + Confidence' : sortMode === 'latest' ? 'Most recently updated' : 'CRITICAL + HIGH only'}
        </span>
      </div>

      {findings.error && !items.length ? (
        <SurfaceErrorState
          title="Finding feed unavailable"
          description={findings.error}
          onRetry={findings.refresh}
        />
      ) : null}

      {emptyState ? (
        <SurfaceEmptyState
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((finding) => (
          <FindingCard
            key={finding.id}
            confidence={finding.confidence}
            footer={(
              <div className="w-full space-y-4">
                <div className="flex min-w-[14rem] flex-col gap-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Signals</p>
                    <p className="text-sm text-[var(--vt-text-2)]">Priority {Math.round(finding.priorityScore)}</p>
                    <ConfidenceMeter confidence={finding.confidence} />
                    <TimestampPair label="Updated" value={finding.updatedAt} />
                  </div>
                  <FindingMutationControls findingId={finding.id} status={finding.status} compact />
                </div>
                {finding.evidence.length > 0 ? (
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Evidence</p>
                      <span className="rounded-full bg-[var(--vt-surface-2)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--vt-text-3)]">
                        {finding.evidence.length} source{finding.evidence.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ul className="space-y-2 text-sm text-[var(--vt-text-2)]">
                      {finding.evidence.slice(0, 2).map((evidence) => (
                        <li key={evidence.id} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[var(--vt-text-1)]">{evidence.label}</span>
                            {evidence.observedAt ? (
                              <span className="text-xs text-[var(--vt-text-3)]" title={formatAbsoluteTime(evidence.observedAt)}>
                                {formatRelativeTime(evidence.observedAt)}
                              </span>
                            ) : null}
                          </div>
                          {evidence.snippet ? <p className="text-[var(--vt-text-3)]">{evidence.snippet}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
            links={(
              <>
                {finding.providerNpi ? (
                  <>
                    <EntityLink
                      href={`/providers/${finding.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                      label={finding.providerLabel ?? `Provider ${finding.providerNpi}`}
                    />
                    <EntityLink href={`/investigations?npi=${finding.providerNpi}`} label="Open investigation" />
                  </>
                ) : null}
                {finding.storylineId ? (
                  <BadgeLink
                    href={`/storylines/${finding.storylineId}?from=${encodeURIComponent(currentHref)}`}
                    label="Storyline"
                    tone="info"
                    title={finding.storylineTitle ?? 'Open storyline'}
                  />
                ) : null}
              </>
            )}
            metadata={(
              <div className="space-y-2">
                <Link
                  href={{
                    pathname: `/findings/${finding.id}`,
                    query: { from: currentHref },
                  }}
                  className="block truncate text-xl font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                >
                  Open detail
                </Link>
                <span className="text-xs text-[var(--vt-text-3)]">{finding.investigatorId}</span>
              </div>
            )}
            severity={finding.severity}
            status={finding.status}
            summary={finding.summary}
            title={finding.title}
            typeLabel={finding.findingType.replace(/_/g, ' ')}
          />
        ))}
      </div>

      {findings.loading && !items.length ? (
        <>
          <OpsCardSkeleton />
          <OpsCardSkeleton />
          <OpsCardSkeleton />
        </>
      ) : null}

      {total > 0 ? (
        <OpsCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--vt-text-2)]">
            {formatPaginationSummary({
              page,
              limit: PAGE_SIZE,
              total,
              label: 'findings',
            })}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => pushWithParams(filters, nextPage)} />
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
