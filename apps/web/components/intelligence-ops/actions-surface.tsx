'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import {
  getAccessEmptyState,
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
} from '@/lib/intelligence/state';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
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
import { ActionMutationControls } from './mutation-controls';
import { formatPaginationSummary, Pagination } from './pagination';
import { ActionCard } from '@/src/ui/components';

const PAGE_SIZE = 10;

function buildProviderDetailHref(npi: string) {
  return buildIntelligenceHref('dashboard', { npi, open: ['provider'] });
}

function buildFindingDetailHref({
  findingId,
  providerNpi,
}: {
  findingId: string;
  providerNpi?: string | null;
}) {
  return buildIntelligenceHref('dashboard', {
    npi: providerNpi ?? undefined,
    findingId,
    open: ['finding'],
  });
}

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
          ? buildIntelligenceHref('actions', params)
          : `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
      );
    });
  }

  const totalPages = actions.data?.pageInfo?.totalPages ?? 1;
  const total = actions.data?.total ?? 0;
  const hasFilters = Object.values(filters).some((value) => value.length > 0);
  const items = actions.data?.actions ?? [];
  const accessState = getAccessEmptyState({
    error: actions.error,
    resourceLabel: 'actions',
  });
  const staleState = getSurfaceFreshnessState({
    generatedAt: actions.data?.generatedAt,
    lastUpdated: actions.lastUpdated,
  });

  return (
    <OperationsShell
      activeHref={pathname === '/intelligence' ? '/intelligence' : '/actions'}
      activeNavKey="actions"
      title="Actions"
      description="Recommendation queue with direct status mutations, detail routes, and links back to the providers and findings that triggered each action."
      breadcrumbs={[{ label: 'Actions' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Action queue</p>
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
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
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
            <span className="text-[var(--vt-text-3)]">Target entity</span>
            <input
              value={draftFilters.entity}
              onChange={(event) => setDraftFilters((current) => ({ ...current, entity: event.target.value }))}
              placeholder="NPI or label"
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Priority</span>
            <select
              value={draftFilters.priority}
              onChange={(event) => setDraftFilters((current) => ({ ...current, priority: event.target.value }))}
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)]"
            >
              <option value="">All priorities</option>
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
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--vt-text-3)]">Action type</span>
            <input
              value={draftFilters.actionType}
              onChange={(event) => setDraftFilters((current) => ({ ...current, actionType: event.target.value }))}
              placeholder="Enter action type"
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
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
                  entity: '',
                  priority: '',
                  status: '',
                  actionType: '',
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

      {accessState && !items.length ? (
        <SurfaceEmptyState
          title={accessState.title}
          description={accessState.description}
        />
      ) : null}

      {actions.error && !items.length && !accessState ? (
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
          <ActionCard
            key={action.id}
            confidence={action.confidence}
            detail={(
              <div className="space-y-3">
                <Link
                  href={{
                    pathname: `/actions/${action.id}`,
                    query: { from: currentHref },
                  }}
                  className="block text-xl font-semibold text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]"
                >
                  Open detail
                </Link>
                <div className="flex flex-wrap gap-2">
                  {action.providerNpi ? (
                    <>
                      <EntityLink
                        href={buildProviderDetailHref(action.providerNpi)}
                        label={action.targetLabel ?? `Provider ${action.providerNpi}`}
                      />
                      <EntityLink href={buildIntelligenceHref('investigations', { npi: action.providerNpi })} label="Open investigation" />
                    </>
                  ) : null}
                  {action.sourceFindingIds[0] ? (
                    <EntityLink
                      href={buildFindingDetailHref({
                        findingId: action.sourceFindingIds[0],
                        providerNpi: action.providerNpi,
                      })}
                      label={`Finding ${action.sourceFindingIds[0]}`}
                    />
                  ) : null}
                  {action.targetLabel && !action.providerNpi ? (
                    <span className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
                      {action.targetLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            explanation={action.explanation}
            footer={(
              <div className="w-full space-y-4">
                <div className="flex min-w-[15rem] flex-col gap-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Queue signals</p>
                    <p className="text-sm text-[var(--vt-text-2)]">Priority score {Math.round(action.priorityScore)}</p>
                    <ConfidenceMeter confidence={action.confidence} />
                    <TimestampPair label="Created" value={action.createdAt} />
                  </div>
                  <ActionMutationControls actionId={action.id} status={action.status} compact />
                </div>
                {action.evidence.length > 0 ? (
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Evidence preview</p>
                    <ul className="space-y-2 text-sm text-[var(--vt-text-2)]">
                      {action.evidence.slice(0, 2).map((evidence) => (
                        <li key={`${evidence.id}-${evidence.label}`} className="space-y-1">
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
            priority={action.priority}
            status={action.status}
            title={action.title}
            typeLabel={action.actionType.replace(/_/g, ' ')}
          />
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
          <p className="text-sm text-[var(--vt-text-2)]">
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
