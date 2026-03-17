'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import {
  hasFindingFilters,
  parseFindingFilters,
  parseMinConfidenceNumber,
  serializeFindingFilters,
} from '@/lib/intelligence/finding-filters';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
import {
  formatLastRefreshMessage,
  getAccessBannerState,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { FindingMutationControls } from './mutation-controls';
import { OperationsShell } from './shell';
import { formatPaginationSummary, Pagination } from './pagination';
import {
  ConfidenceMeter,
  EntityLink,
  OpsBadge,
  OpsCard,
  OpsCardSkeleton,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  TimestampPair,
  severityTone,
} from './primitives';

const PAGE_SIZE = 10;

function formatFindingType(findingType: string) {
  return findingType.replace(/_/g, ' ');
}

export function FindingsSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const searchQuery = searchParams.toString();
  const providerScope = searchParams.get('provider') ?? searchParams.get('providerId');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = useMemo(() => parseFindingFilters(searchParams), [searchQuery]);
  const hasScopedFilters = hasFindingFilters(filters) || Boolean(providerScope);
  const [criticalOnly, setCriticalOnly] = useState(false);

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

  const currentHref = useMemo(() => {
    return `${pathname}${searchQuery ? `?${searchQuery}` : ''}`;
  }, [pathname, searchQuery]);

  function pushWithParams(nextPage = 1) {
    const params = serializeFindingFilters(filters, { page: nextPage });
    if (providerScope) {
      params.set('provider', providerScope);
    }

    startTransition(() => {
      router.push(
        pathname === '/intelligence'
          ? buildIntelligenceHref('findings', params)
          : `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
      );
    });
  }

  const accessBanner = getAccessBannerState(findings.data?.accessMode, findings.data?.reason);
  const staleState = getSurfaceFreshnessState({
    generatedAt: findings.data?.generatedAt,
    lastUpdated: findings.lastUpdated,
  });
  const rawItems = findings.data?.findings ?? [];
  const items = criticalOnly
    ? rawItems.filter((finding) => finding.severity === 'critical')
    : rawItems;
  const total = findings.data?.total ?? 0;
  const totalPages = findings.data?.pageInfo?.totalPages ?? 1;
  const apiReturnedEmpty = !findings.loading && !findings.error && rawItems.length === 0;
  const criticalFilterRemovedAll = !findings.loading && !findings.error && rawItems.length > 0 && items.length === 0;

  return (
    <OperationsShell
      activeHref={pathname === '/intelligence' ? '/intelligence' : '/findings'}
      activeNavKey="findings"
      title="Findings"
      description="Live investigator findings with direct links across providers, storylines, and actions as soon as the backend feed is available."
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
          {accessBanner ? (
            <SurfaceBanner tone={accessBanner.tone}>
              {accessBanner.description}
            </SurfaceBanner>
          ) : null}
          {findings.recovering && findings.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful findings snapshot while background retries continue.
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
      <OpsCard className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">List controls</p>
          <p className="text-sm text-[var(--vt-text-2)]">
            {hasScopedFilters
              ? 'Query filters from the current route are active.'
              : 'Rendering the live feed order returned by the backend.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-[var(--vt-border)] p-1">
            {[
              { label: 'All Findings', critical: false },
              { label: 'Critical Only', critical: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setCriticalOnly(option.critical)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  criticalOnly === option.critical
                    ? 'bg-cyan-400/12 text-[var(--vt-text-1)]'
                    : 'text-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-[var(--vt-text-3)]">
            {criticalOnly ? `${items.length} visible on this page` : 'Severity, confidence, and relative time are live.'}
          </span>
        </div>
      </OpsCard>

      {findings.error && rawItems.length === 0 ? (
        <SurfaceErrorState
          title="Finding feed unavailable"
          description={findings.error}
          onRetry={findings.refresh}
        />
      ) : null}

      {apiReturnedEmpty ? (
        <SurfaceEmptyState
          title="No findings returned"
          description={hasScopedFilters
            ? 'The current backend query returned zero findings for this scope.'
            : 'No investigator findings are available yet for the current environment.'}
        />
      ) : null}

      {criticalFilterRemovedAll ? (
        <OpsCard className="border-dashed">
          <div className="space-y-1 text-sm text-[var(--vt-text-2)]">
            <p className="font-semibold text-[var(--vt-text-1)]">No critical findings on this page</p>
            <p>The API returned findings, but none of them are currently marked `critical`.</p>
          </div>
        </OpsCard>
      ) : null}

      <div className="grid gap-4">
        {items.map((finding) => (
          <OpsCard key={finding.id} className="overflow-hidden">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={formatFindingType(finding.findingType)} />
                  <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                  <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
                  <span className="text-xs text-[var(--vt-text-3)]">{finding.investigatorId}</span>
                </div>

                <div className="space-y-2">
                  <Link
                    href={{
                      pathname: `/findings/${finding.id}`,
                      query: { from: currentHref },
                    }}
                    className="block text-xl font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                  >
                    {finding.title}
                  </Link>
                  <p className="max-w-4xl text-sm leading-6 text-[var(--vt-text-2)]">{finding.summary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {finding.providerNpi ? (
                    <Link
                      href={`/providers/${finding.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                      className="font-medium text-cyan-300 transition hover:text-[var(--vt-accent)]"
                    >
                      {finding.providerLabel ?? `Provider ${finding.providerNpi}`}
                    </Link>
                  ) : (
                    <span className="text-[var(--vt-text-3)]">Provider not attached</span>
                  )}
                  {finding.storylineId ? (
                    <EntityLink
                      href={`/storylines/${finding.storylineId}?from=${encodeURIComponent(currentHref)}`}
                      label={finding.storylineTitle ?? 'Open storyline'}
                    />
                  ) : null}
                  {finding.providerNpi ? (
                    <EntityLink
                      href={buildIntelligenceHref('findings', { provider: finding.providerNpi })}
                      label="Provider findings"
                    />
                  ) : null}
                </div>

                {finding.evidence.length > 0 ? (
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Evidence preview</p>
                      <span className="text-xs text-[var(--vt-text-3)]">{finding.evidence.length} sources</span>
                    </div>
                    <ul className="space-y-3">
                      {finding.evidence.slice(0, 3).map((evidence) => (
                        <li key={evidence.id} className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[var(--vt-text-1)]">{evidence.label}</span>
                            {evidence.observedAt ? (
                              <span className="text-xs text-[var(--vt-text-3)]" title={formatAbsoluteTime(evidence.observedAt)}>
                                {formatRelativeTime(evidence.observedAt)}
                              </span>
                            ) : null}
                          </div>
                          {evidence.snippet ? (
                            <p className="leading-6 text-[var(--vt-text-2)]">{evidence.snippet}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="w-full max-w-sm shrink-0 space-y-4">
                <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Confidence</p>
                  <div className="mt-3">
                    <ConfidenceMeter confidence={finding.confidence} />
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[var(--vt-text-2)]">
                    <p>Priority {Math.round(finding.priorityScore)}</p>
                    <TimestampPair label="First seen" value={finding.firstSeenAt} />
                    <TimestampPair label="Updated" value={finding.updatedAt} />
                  </div>
                </div>

                <FindingMutationControls findingId={finding.id} status={finding.status} compact />
              </div>
            </div>
          </OpsCard>
        ))}
      </div>

      {findings.loading && rawItems.length === 0 ? (
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
          <Pagination page={page} totalPages={totalPages} onPageChange={pushWithParams} />
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
