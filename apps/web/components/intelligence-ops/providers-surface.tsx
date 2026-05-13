'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useProviders } from '@/hooks/useProviders';
import {
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { EntityLink, OpsCard, OpsCardSkeleton, SurfaceBanner, SurfaceEmptyState, SurfaceErrorState, TimestampPair, trustScoreColor } from './primitives';
import { formatPaginationSummary, Pagination } from './pagination';
import { ProviderCard } from '@/src/ui/components';

const PAGE_SIZE = 12;

export function ProvidersSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = {
    q: searchParams.get('q') ?? '',
    minTrustScore: searchParams.get('minTrustScore') ?? '',
  };
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters.minTrustScore, filters.q]);

  const providers = useProviders({
    query: filters.q,
    page,
    limit: PAGE_SIZE,
    minTrustScore: filters.minTrustScore ? Number(filters.minTrustScore) : 0,
  });

  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);

  function pushWithParams(nextPage = 1, nextFilters = draftFilters) {
    const params = new URLSearchParams();
    if (nextFilters.q.trim().length > 0) {
      params.set('q', nextFilters.q.trim());
    }
    if (nextFilters.minTrustScore.trim().length > 0) {
      params.set('minTrustScore', nextFilters.minTrustScore.trim());
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    startTransition(() => {
      router.push(
        pathname === '/intelligence'
          ? buildIntelligenceHref('providers', params)
          : `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
      );
    });
  }

  const items = providers.data?.providers ?? [];
  const totalPages = providers.data?.pageInfo?.totalPages ?? 1;
  const total = providers.data?.total ?? 0;
  const hasFilters = filters.q.length > 0 || filters.minTrustScore.length > 0;
  const staleState = getSurfaceFreshnessState({
    generatedAt: providers.data?.generatedAt,
    lastUpdated: providers.lastUpdated,
  });

  return (
    <OperationsShell
      activeHref={pathname === '/intelligence' ? '/intelligence' : '/providers'}
      activeNavKey="providers"
      title="Providers"
      description="Provider directory surface with search, trust-score filtering, detail routes, and cross-navigation into investigations."
      breadcrumbs={[{ label: 'Providers' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Directory state</p>
          <p>{providers.data?.total ?? 0} matching providers</p>
          {providers.lastUpdated ? (
            <p title={formatAbsoluteTime(providers.lastUpdated)}>Updated {formatRelativeTime(providers.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={providers.refresh}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
      banner={(
        <>
          {providers.recovering && providers.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful directory snapshot while retries continue.
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
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            pushWithParams(1);
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Search</span>
            <input
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Name, NPI, specialty, issuer"
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Minimum trust score</span>
            <input
              value={draftFilters.minTrustScore}
              onChange={(event) => setDraftFilters((current) => ({ ...current, minTrustScore: event.target.value }))}
              placeholder="0-100"
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="submit"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--vt-accent)]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = { q: '', minTrustScore: '' };
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

      {providers.error && !items.length ? (
        <SurfaceErrorState
          title="Provider directory unavailable"
          description={providers.error}
          onRetry={providers.refresh}
        />
      ) : null}

      {!providers.loading && !providers.error && !items.length ? (
        <SurfaceEmptyState
          title={hasFilters ? 'No providers match the current filters' : 'No providers available'}
          description={hasFilters
            ? 'Adjust the search terms or score threshold to widen the result set.'
            : 'No provider records were returned for the current environment.'}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((provider) => (
          <ProviderCard
            key={provider.npi}
            credentialHealth={provider.credentialHealth}
            footer={(
              <div className="flex flex-wrap gap-2">
                <EntityLink href={`/providers/${provider.npi}?from=${encodeURIComponent(currentHref)}`} label="Open profile" />
                <EntityLink href={buildIntelligenceHref('findings', { provider: provider.npi })} label="View findings" />
                <EntityLink href={buildIntelligenceHref('storylines', { provider: provider.npi })} label="View storylines" />
                <EntityLink href={buildIntelligenceGraphHref({ npi: provider.npi, providerId: provider.npi })} label="Open graph" />
                <EntityLink href={buildIntelligenceHref('investigations', { npi: provider.npi })} label="Investigate" />
              </div>
            )}
            meta={(
              <div className="space-y-3">
                <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Trust</p>
                  <p className={`text-2xl font-semibold tabular-nums ${trustScoreColor(provider.trustScore)}`}>{provider.trustScore}</p>
                </div>
                <div className="space-y-1 text-sm text-[var(--vt-text-2)]">
                  <p className="font-mono text-sm text-[var(--vt-text-3)]">NPI {provider.npi}</p>
                  <p>{provider.activeCredentials}/{provider.credentialCount} active credentials</p>
                  <TimestampPair label="Last confirmed" value={provider.lastVerifiedAt} />
                </div>
              </div>
            )}
            name={provider.name}
            specialties={provider.specialties.slice(0, 3)}
            summary={provider.summary}
            trustScore={provider.trustScore}
          />
        ))}
      </div>

      {providers.loading && !items.length ? (
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
              label: 'providers',
            })}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={pushWithParams} />
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
