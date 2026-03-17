'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStorylines } from '@/hooks/useStorylines';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import {
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
  hasDegradedDataSources,
} from '@/lib/intelligence/state';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
import { summarizeTrustSignals } from '@/lib/intelligence/trust-signals';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import {
  EntityLink,
  OpsCard,
  OpsCardSkeleton,
  ConfidenceMeter,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  TimestampPair,
} from './primitives';
import { StorylineMutationControls } from './mutation-controls';
import { formatPaginationSummary, Pagination } from './pagination';
import { TrustSignalChips } from './trust-signal-chips';
import { StorylineCard } from '@/src/ui/components';

const PAGE_SIZE = 8;

export function StorylinesSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = {
    provider: searchParams.get('provider') ?? '',
    severity: searchParams.get('severity') ?? '',
    status: searchParams.get('status') ?? '',
    perspective: searchParams.get('perspective') ?? '',
    storylineType: searchParams.get('storylineType') ?? '',
  };
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters.perspective, filters.provider, filters.severity, filters.status, filters.storylineType]);

  const storylines = useStorylines({
    provider: filters.provider || null,
    severity: filters.severity || null,
    status: filters.status || null,
    perspective: filters.perspective || null,
    storylineType: filters.storylineType || null,
    page,
    limit: PAGE_SIZE,
  });
  const systemHealth = useSystemHealth();

  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);

  function pushWithParams(nextPage = 1, nextFilters = draftFilters) {
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value.trim().length > 0) {
        params.set(key, value.trim());
      }
    });
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    startTransition(() => {
      router.push(
        pathname === '/intelligence'
          ? buildIntelligenceHref('storylines', params)
          : `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
      );
    });
  }

  const totalPages = storylines.data?.pageInfo?.totalPages ?? 1;
  const total = storylines.data?.total ?? 0;
  const hasFilters = Object.values(filters).some((value) => value.length > 0);
  const items = storylines.data?.storylines ?? [];
  const staleState = getSurfaceFreshnessState({
    generatedAt: storylines.data?.generatedAt,
    lastUpdated: storylines.lastUpdated,
  });
  const degradedSources = hasDegradedDataSources(systemHealth.data);

  return (
    <OperationsShell
      activeHref={pathname === '/intelligence' ? '/intelligence' : '/storylines'}
      activeNavKey="storylines"
      title="Storylines"
      description="Narrative clusters over the finding feed, with cross-links back to findings, providers, and investigations."
      breadcrumbs={[{ label: 'Storylines' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Storyline sync</p>
          <p>{storylines.data?.total ?? 0} total storylines</p>
          {storylines.lastUpdated ? (
            <p title={formatAbsoluteTime(storylines.lastUpdated)}>Updated {formatRelativeTime(storylines.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={storylines.refresh}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
      banner={(
        <>
          {storylines.recovering && storylines.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful storyline snapshot while background retries continue.
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
          {storylines.data?.degraded ? (
            <SurfaceBanner tone="info">
              Deep pagination is being served from the latest synchronized storyline window because the backend list route does not expose native offsets yet.
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      <OpsCard>
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            pushWithParams(1);
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Provider NPI</span>
            <input
              value={draftFilters.provider}
              onChange={(event) => setDraftFilters((current) => ({ ...current, provider: event.target.value }))}
              placeholder="1234567890"
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Severity</span>
            <select
              value={draftFilters.severity}
              onChange={(event) => setDraftFilters((current) => ({ ...current, severity: event.target.value }))}
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)]"
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)]"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="quiet">Quiet</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Perspective</span>
            <select
              value={draftFilters.perspective}
              onChange={(event) => setDraftFilters((current) => ({ ...current, perspective: event.target.value }))}
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)]"
            >
              <option value="">All perspectives</option>
              <option value="provider">Provider</option>
              <option value="institution">Institution</option>
              <option value="network">Network</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Storyline type</span>
            <input
              value={draftFilters.storylineType}
              onChange={(event) => setDraftFilters((current) => ({ ...current, storylineType: event.target.value }))}
              placeholder="compliance risk"
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-5">
            <button
              type="submit"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--vt-accent)]"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = {
                  provider: '',
                  severity: '',
                  status: '',
                  perspective: '',
                  storylineType: '',
                };
                setDraftFilters(cleared);
                pushWithParams(1, cleared);
              }}
              className="rounded-full border border-[var(--vt-border)] px-4 py-2 text-sm font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
            >
              Clear
            </button>
          </div>
        </form>
      </OpsCard>

      {storylines.error && !items.length ? (
        <SurfaceErrorState
          title="Storylines unavailable"
          description={storylines.error}
          onRetry={storylines.refresh}
        />
      ) : null}

      {!storylines.loading && !storylines.error && !items.length ? (
        <SurfaceEmptyState
          title={hasFilters ? 'No storylines match the current filters' : 'No storyline clusters are active'}
          description={hasFilters
            ? 'Widen the filters or remove them to inspect more of the storyline set.'
            : 'Storylines will appear here after related findings are synchronized into a cluster.'}
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((storyline) => (
          <StorylineCard
            key={storyline.id}
            confidence={storyline.confidence}
            footer={(
              <div className="w-full space-y-4">
                <div className="flex min-w-[15rem] flex-col gap-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Narrative stats</p>
                      <p className="text-sm text-[var(--vt-text-2)]">Progression {Math.round(storyline.progressionScore * 100)}%</p>
                      <ConfidenceMeter confidence={storyline.confidence} />
                      <TimestampPair label="Activity" value={storyline.lastActivityAt} />
                    </div>
                    <TrustSignalChips
                      summary={summarizeTrustSignals(
                        storyline.evidence.map((evidence) => ({
                          source: evidence.source,
                          observedAt: evidence.observedAt,
                        })),
                        storyline.confidence,
                      )}
                    />
                  </div>
                  <StorylineMutationControls storylineId={storyline.id} status={storyline.status} compact />
                </div>
                {storyline.recommendedActions.length > 0 ? (
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Recommended actions</p>
                    <ul className="space-y-2 text-sm text-[var(--vt-text-2)]">
                      {storyline.recommendedActions.slice(0, 3).map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
            highlights={(
              <div className="space-y-3">
                <Link
                  href={{
                    pathname: `/storylines/${storyline.id}`,
                    query: { from: currentHref },
                  }}
                  className="block truncate text-xl font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                >
                  Open detail
                </Link>
                <p className="max-w-3xl text-sm leading-6 text-[var(--vt-text-3)]">{storyline.whyItMatters}</p>
                <p className="text-xs text-[var(--vt-text-3)]">{storyline.perspective}</p>
                <div className="flex flex-wrap gap-2">
                  {storyline.providerNpi ? (
                    <>
                      <EntityLink href={`/providers/${storyline.providerNpi}?from=${encodeURIComponent(currentHref)}`} label={`Provider ${storyline.providerNpi}`} />
                      <EntityLink href={buildIntelligenceHref('investigations', { npi: storyline.providerNpi })} label="Open investigation" />
                    </>
                  ) : null}
                  {storyline.findingIds.length > 0 ? (
                    <EntityLink href={`/findings/${storyline.findingIds[0]}?from=/storylines`} label={`Lead finding ${storyline.findingIds[0]}`} />
                  ) : null}
                </div>
              </div>
            )}
            severity={storyline.severity}
            status={storyline.status}
            summary={storyline.summary}
            title={storyline.title}
            typeLabel={storyline.storylineType}
          />
        ))}
      </div>

      {storylines.loading && !items.length ? (
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
              label: 'storylines',
            })}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={pushWithParams} />
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
