'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import {
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
  hasDegradedDataSources,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import {
  EntityLink,
  OpsBadge,
  OpsCard,
  OpsCardSkeleton,
  ConfidenceMeter,
  SurfaceBanner,
  SurfaceEmptyState,
  SurfaceErrorState,
  TimestampPair,
  severityTone,
} from './primitives';
import { ActionMutationControls } from './mutation-controls';
import { formatPaginationSummary, Pagination } from './pagination';

const PAGE_SIZE = 10;

export function ActionsSurface() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filters = {
    entity: searchParams.get('entity') ?? '',
    priority: searchParams.get('priority') ?? '',
    status: searchParams.get('status') ?? '',
    actionType: searchParams.get('actionType') ?? '',
  };
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters.actionType, filters.entity, filters.priority, filters.status]);

  const actions = useActions({
    entity: filters.entity || null,
    priority: filters.priority || null,
    status: filters.status || null,
    actionType: filters.actionType || null,
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
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    });
  }

  const totalPages = actions.data?.pageInfo?.totalPages ?? 1;
  const total = actions.data?.total ?? 0;
  const hasFilters = Object.values(filters).some((value) => value.length > 0);
  const items = actions.data?.actions ?? [];
  const staleState = getSurfaceFreshnessState({
    generatedAt: actions.data?.generatedAt,
    lastUpdated: actions.lastUpdated,
  });
  const degradedSources = hasDegradedDataSources(systemHealth.data);

  return (
    <OperationsShell
      activeHref="/actions"
      title="Actions"
      description="Recommendation queue with direct status mutations, detail routes, and links back to the providers and findings that triggered each action."
      breadcrumbs={[{ label: 'Actions' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Action queue</p>
          <p>{actions.data?.total ?? 0} total actions</p>
          {actions.lastUpdated ? (
            <p title={formatAbsoluteTime(actions.lastUpdated)}>Updated {formatRelativeTime(actions.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={actions.refresh}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
      banner={(
        <>
          {actions.recovering && actions.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful action queue snapshot while retries continue.
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
      <OpsCard>
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            pushWithParams(1);
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Target entity</span>
            <input
              value={draftFilters.entity}
              onChange={(event) => setDraftFilters((current) => ({ ...current, entity: event.target.value }))}
              placeholder="NPI or label"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-slate-500"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Priority</span>
            <select
              value={draftFilters.priority}
              onChange={(event) => setDraftFilters((current) => ({ ...current, priority: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white"
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Action type</span>
            <input
              value={draftFilters.actionType}
              onChange={(event) => setDraftFilters((current) => ({ ...current, actionType: event.target.value }))}
              placeholder="VERIFY_LICENSE"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-slate-500"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
            <button
              type="submit"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = {
                  entity: '',
                  priority: '',
                  status: '',
                  actionType: '',
                };
                setDraftFilters(cleared);
                pushWithParams(1, cleared);
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white"
            >
              Clear
            </button>
          </div>
        </form>
      </OpsCard>

      {actions.error && !items.length ? (
        <SurfaceErrorState
          title="Actions unavailable"
          description={actions.error}
          onRetry={actions.refresh}
        />
      ) : null}

      {!actions.loading && !actions.error && !items.length ? (
        <SurfaceEmptyState
          title={hasFilters ? 'No actions match the current filters' : 'No recommended actions are queued'}
          description={hasFilters
            ? 'Adjust or clear the filters to widen the queue.'
            : 'The action engine has not queued any active recommendations in the current environment.'}
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((action) => (
          <OpsCard key={action.id} className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={action.priority} tone={severityTone(action.priority)} />
                  <OpsBadge label={action.status} tone={severityTone(action.status)} />
                  <OpsBadge label={action.actionType.replace(/_/g, ' ')} />
                </div>
                <div className="space-y-2">
                  <Link
                    href={{
                      pathname: `/actions/${action.id}`,
                      query: { from: currentHref },
                    }}
                    className="block text-xl font-semibold text-white transition hover:text-cyan-200"
                  >
                    {action.title}
                  </Link>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300">{action.explanation}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {action.providerNpi ? (
                    <>
                      <EntityLink
                        href={`/providers/${action.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                        label={action.targetLabel ?? `Provider ${action.providerNpi}`}
                      />
                      <EntityLink href={`/investigations?npi=${action.providerNpi}`} label="Open investigation" />
                    </>
                  ) : null}
                  {action.sourceFindingIds[0] ? (
                    <EntityLink
                      href={`/findings/${action.sourceFindingIds[0]}?from=${encodeURIComponent(currentHref)}`}
                      label={`Finding ${action.sourceFindingIds[0]}`}
                    />
                  ) : null}
                  {action.targetLabel && !action.providerNpi ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {action.targetLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-[15rem] flex-col gap-3 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Queue signals</p>
                  <p className="text-sm text-slate-200">Priority score {Math.round(action.priorityScore)}</p>
                  <ConfidenceMeter confidence={action.confidence} />
                  <TimestampPair label="Created" value={action.createdAt} />
                </div>
                <ActionMutationControls actionId={action.id} status={action.status} compact />
              </div>
            </div>

            {action.evidence.length > 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence preview</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {action.evidence.slice(0, 2).map((evidence) => (
                    <li key={`${evidence.id}-${evidence.label}`} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{evidence.label}</span>
                        {evidence.observedAt ? (
                          <span className="text-xs text-slate-500" title={formatAbsoluteTime(evidence.observedAt)}>
                            {formatRelativeTime(evidence.observedAt)}
                          </span>
                        ) : null}
                      </div>
                      {evidence.snippet ? <p className="text-slate-400">{evidence.snippet}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </OpsCard>
        ))}
      </div>

      {actions.loading && !items.length ? (
        <>
          <OpsCardSkeleton />
          <OpsCardSkeleton />
          <OpsCardSkeleton />
        </>
      ) : null}

      {total > 0 ? (
        <OpsCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-300">
            {formatPaginationSummary({
              page,
              limit: PAGE_SIZE,
              total,
              label: 'actions',
            })}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={pushWithParams} />
        </OpsCard>
      ) : null}
    </OperationsShell>
  );
}
