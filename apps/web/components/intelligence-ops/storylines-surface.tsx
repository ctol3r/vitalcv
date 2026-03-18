'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStorylines } from '@/hooks/useStorylines';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { formatLastRefreshMessage, getSurfaceFreshnessState } from '@/lib/intelligence/state';
import type { IntelligenceStoryline } from '@/lib/intelligence/contracts';
import { StorylineMutationControls } from './mutation-controls';
import { OperationsShell } from './shell';
import { formatPaginationSummary, Pagination } from './pagination';
import {
  EntityLink,
  OpsBadge,
  OpsCard,
  OpsCardSkeleton,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  severityTone,
} from './primitives';

const PAGE_SIZE = 8;

function buildTimeline(storyline: IntelligenceStoryline) {
  const evidenceEvents = storyline.evidence
    .map((evidence, index) => ({
      id: `${storyline.id}:${index}`,
      occurredAt: evidence.observedAt ?? storyline.lastActivityAt,
      label: evidence.source ?? evidence.label,
      detail: evidence.snippet ?? `${evidence.label} updated this storyline.`,
    }))
    .slice(0, 4);

  if (evidenceEvents.length > 0) {
    return evidenceEvents;
  }

  return [{
    id: `${storyline.id}:activity`,
    occurredAt: storyline.lastActivityAt,
    label: 'Latest activity',
    detail: storyline.summary,
  }];
}

function formatStorylineType(value: string) {
  return value.replace(/_/g, ' ');
}

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

  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);

  function pushWithParams(nextPage = 1, nextFilters = draftFilters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value.trim().length > 0) {
        params.set(key, value.trim());
      }
    }
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

  const items = storylines.data?.storylines ?? [];
  const total = storylines.data?.total ?? 0;
  const totalPages = storylines.data?.pageInfo?.totalPages ?? 1;
  const hasFilters = Object.values(filters).some((value) => value.length > 0);
  const staleState = getSurfaceFreshnessState({
    generatedAt: storylines.data?.generatedAt,
    lastUpdated: storylines.lastUpdated,
  });

  return (
    <OperationsShell
      activeHref={pathname === '/intelligence' ? '/intelligence' : '/storylines'}
      activeNavKey="storylines"
      title="Storylines"
      description="Narrative clusters linked to real findings, providers, and action context as soon as the backend feed is available."
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
          {staleState.isStale && staleState.ageMinutes !== null ? (
            <SurfaceBanner tone="info">
              {formatLastRefreshMessage(staleState.ageMinutes)}
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

      {storylines.error && items.length === 0 ? (
        <SurfaceErrorState
          title="Storylines unavailable"
          description={storylines.error}
          onRetry={storylines.refresh}
        />
      ) : null}

      {!storylines.loading && !storylines.error && items.length === 0 ? (
        <SurfaceEmptyState
          title={hasFilters ? 'No storylines match the current filters' : 'Clustering intelligence...'}
          description={hasFilters
            ? 'The current backend query returned zero storyline clusters for this scope.'
            : 'Synthesizing emerging narrative clusters...'}
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((storyline) => {
          const timeline = buildTimeline(storyline);

          return (
            <OpsCard key={storyline.id}>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
                    <OpsBadge label={storyline.status} tone={severityTone(storyline.status)} />
                    <OpsBadge label={formatStorylineType(storyline.storylineType)} />
                    <span className="text-xs text-[var(--vt-text-3)]">{storyline.perspective}</span>
                  </div>

                  <div className="space-y-2">
                    <Link
                      href={{
                        pathname: `/storylines/${storyline.id}`,
                        query: { from: currentHref },
                      }}
                      className="block text-xl font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                    >
                      {storyline.title}
                    </Link>
                    <p className="text-sm leading-6 text-[var(--vt-text-2)]">{storyline.summary}</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
                    <div className="space-y-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Timeline</p>
                        <span className="text-xs text-[var(--vt-text-3)]">{timeline.length} events</span>
                      </div>
                      <ol className="space-y-3 border-l border-[var(--vt-border)] pl-4">
                        {timeline.map((event) => (
                          <li key={event.id} className="relative space-y-1">
                            <span className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400/70" />
                            <p className="text-sm font-medium text-[var(--vt-text-1)]">{event.label}</p>
                            <p className="text-sm leading-6 text-[var(--vt-text-2)]">{event.detail}</p>
                            <p className="text-xs text-[var(--vt-text-3)]" title={formatAbsoluteTime(event.occurredAt)}>
                              {formatRelativeTime(event.occurredAt)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="space-y-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Linked findings</p>
                        <span className="text-xs text-[var(--vt-text-3)]">{storyline.findingIds.length}</span>
                      </div>
                      {storyline.findingIds.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {storyline.findingIds.map((findingId) => (
                            <EntityLink
                              key={findingId}
                              href={`/findings/${findingId}?from=${encodeURIComponent(currentHref)}`}
                              label={`Finding ${findingId}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--vt-text-2)]">No findings are linked to this storyline yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {storyline.providerNpi ? (
                      <>
                        <EntityLink
                          href={`/providers/${storyline.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                          label={`Provider ${storyline.providerNpi}`}
                        />
                        <EntityLink
                          href={buildIntelligenceHref('findings', { provider: storyline.providerNpi })}
                          label="Provider findings"
                        />
                      </>
                    ) : null}
                    <EntityLink
                      href={buildIntelligenceGraphHref({
                        npi: storyline.providerNpi,
                        providerId: storyline.providerNpi,
                        storylineId: storyline.id,
                      })}
                      label="Open graph"
                    />
                    <EntityLink
                      href={buildIntelligenceHref('investigations', {
                        npi: storyline.providerNpi,
                        storylineId: storyline.id,
                      })}
                      label="Investigate"
                    />
                  </div>
                </div>

                <div className="w-full max-w-sm shrink-0 space-y-4">
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Storyline health</p>
                    <div className="mt-3 space-y-2 text-sm text-[var(--vt-text-2)]">
                      <p>{storyline.findingIds.length} findings</p>
                      <p>{Math.round(storyline.confidence * 100)}% confidence</p>
                      <p>Progression {Math.round(storyline.progressionScore * 100)}%</p>
                      <p title={formatAbsoluteTime(storyline.lastActivityAt)}>
                        Active {formatRelativeTime(storyline.lastActivityAt)}
                      </p>
                    </div>
                  </div>

                  <StorylineMutationControls storylineId={storyline.id} status={storyline.status} compact />
                </div>
              </div>
            </OpsCard>
          );
        })}
      </div>

      {storylines.loading && items.length === 0 ? (
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
