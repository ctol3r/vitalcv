'use client';

/**
 * BoardClient — the public opportunities board.
 *
 * URL is the single source of truth. Every facet change rewrites the query
 * string via router.replace, and state is re-derived from it, so a shared link
 * reproduces the exact view and the back button works.
 *
 * The board fetches the matching set once per filter change and finishes the
 * keyword/sort/paging work in board-query.ts. That is a transitional
 * arrangement — see the note there — and it is why `truncated` is surfaced
 * rather than hidden: the board must never print a total it cannot stand behind.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  type BoardFilters,
  type BoardSort,
  EMPTY_BOARD_FILTERS,
  activeFilterSummary,
  clearFilter,
  hasActiveFilters,
  normalizeBoardFilters,
  parseBoardFilters,
  serializeBoardFilters,
  toApiQuery,
} from '@/lib/explore/board-filters';
import { applyBoardQuery } from '@/lib/explore/board-query';
import { BoardFilterPanel } from './BoardFilterPanel';
import { BoardResultRow } from './BoardResultRow';
import { BoardSortControl } from './BoardSortControl';
import { BoardPagination } from './BoardPagination';

type LoadState = 'loading' | 'ready' | 'error';

const RULE = 'var(--rule, #C9C3B6)';
const RULE_SOFT = 'var(--rule-soft, #DAD5C9)';

export function BoardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL → state. Re-derived on every navigation, so back/forward just work.
  const filters = useMemo(() => parseBoardFilters(searchParams), [searchParams]);

  const [results, setResults] = useState<OpportunitySummary[]>([]);
  const [serviceTotal, setServiceTotal] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // The keyword box is typed into freely; the URL only catches up on a pause,
  // so we don't push a history entry per keystroke.
  const [queryDraft, setQueryDraft] = useState(filters.q);
  useEffect(() => { setQueryDraft(filters.q); }, [filters.q]);

  // Once readiness has ever resolved we keep the facet available, so narrowing
  // to zero results doesn't make the control vanish mid-session.
  const readinessSeen = useRef(false);

  const pushFilters = useCallback((next: BoardFilters) => {
    const params = serializeBoardFilters(next);
    const qs = params.toString();
    router.replace(qs ? `/explore?${qs}` : '/explore', { scroll: false });
  }, [router]);

  const update = useCallback((patch: Partial<BoardFilters>) => {
    // Any facet change returns to page 1 — page 7 of the previous query is
    // meaningless against a different result set.
    pushFilters(normalizeBoardFilters({ ...filters, ...patch, page: patch.page ?? 1 }));
  }, [filters, pushFilters]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (queryDraft !== filters.q) update({ q: queryDraft });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [queryDraft, filters.q, update]);

  // Only the parameters the service understands belong in the fetch key —
  // re-fetching on a sort or page change would be a wasted round trip.
  const apiQuery = useMemo(() => toApiQuery(filters).toString(), [filters]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setState('loading');
    setErrorDetail(null);

    fetch(`/api/opportunities?${apiQuery}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'Request failed');
        }
        return payload as { opportunities?: OpportunitySummary[]; total?: number };
      })
      .then((payload) => {
        if (cancelled) return;
        const opportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];
        if (opportunities.some((o) => o.comparison)) readinessSeen.current = true;
        setResults(opportunities);
        setServiceTotal(typeof payload.total === 'number' ? payload.total : opportunities.length);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setErrorDetail(error instanceof Error ? error.message : null);
        setState('error');
      });

    return () => { cancelled = true; controller.abort(); };
  }, [apiQuery]);

  const view = useMemo(
    () => applyBoardQuery(results, filters, serviceTotal),
    [results, filters, serviceTotal],
  );

  const active = activeFilterSummary(filters);
  const readinessAvailable = readinessSeen.current;

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <div className="lg:hidden" style={{ marginBottom: 16 }}>
          <KeywordInput value={queryDraft} onChange={setQueryDraft} />
        </div>
        <BoardFilterPanel
          filters={filters}
          onChange={update}
          readinessAvailable={readinessAvailable}
        />
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => pushFilters(EMPTY_BOARD_FILTERS)}
            className="mz-small mt-4 underline"
            style={{ color: 'var(--vt-text-secondary)' }}
          >
            Clear all filters
          </button>
        )}
      </div>

      <div>
        <div className="hidden lg:block" style={{ marginBottom: 14 }}>
          <KeywordInput value={queryDraft} onChange={setQueryDraft} />
        </div>

        <div
          className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3"
          style={{ borderColor: RULE }}
        >
          <p className="mz-mono" style={{ margin: 0, fontSize: 12.5, color: 'var(--vt-text-secondary)' }}>
            {state === 'loading' && 'Loading…'}
            {state === 'error' && 'Unavailable'}
            {state === 'ready' && (
              view.truncated
                ? `${view.matched}+ roles`
                : `${view.matched} ${view.matched === 1 ? 'role' : 'roles'}`
            )}
          </p>
          <BoardSortControl
            value={filters.sort}
            onChange={(sort: BoardSort) => update({ sort })}
          />
        </div>

        {active.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            {active.map(({ key, label }) => (
              <button
                key={String(key)}
                type="button"
                onClick={() => pushFilters(clearFilter(filters, key))}
                className="border px-2 py-1 text-[11.5px]"
                style={{ borderRadius: 3, borderColor: RULE, color: 'var(--vt-text-secondary)' }}
                aria-label={`Remove filter ${label}`}
              >
                {label} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {view.truncated && state === 'ready' && (
          <p className="mz-small" style={{ marginTop: 12, color: 'var(--vt-text-muted)' }}>
            More roles match than can be listed at once. Narrow the filters to see the rest.
          </p>
        )}

        <div style={{ marginTop: 4 }}>
          {state === 'error' && (
            <Note
              title="Roles could not load"
              body={errorDetail
                ? `The opportunity feed returned: ${errorDetail}`
                : 'The opportunity feed did not respond. Nothing about your profile changed.'}
            />
          )}

          {state === 'ready' && view.matched === 0 && (
            <EmptyResult filters={filters} onClear={(key) => pushFilters(clearFilter(filters, key))} />
          )}

          {state === 'ready' && view.page.map((opportunity) => (
            <BoardResultRow key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>

        {state === 'ready' && view.totalPages > 1 && (
          <BoardPagination
            page={Math.min(filters.page, view.totalPages)}
            totalPages={view.totalPages}
            onPage={(page) => {
              pushFilters(normalizeBoardFilters({ ...filters, page }));
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>
    </div>
  );
}

function KeywordInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Role, specialty, or employer"
      aria-label="Search roles"
      className="w-full border px-3 py-2 text-[14px]"
      style={{
        borderRadius: 3,
        borderColor: RULE,
        background: 'var(--card, #FBFAF6)',
        color: 'var(--vt-text-primary)',
      }}
    />
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 py-3 pl-3" style={{ borderColor: RULE, marginTop: 20 }}>
      <p className="mz-small" style={{ margin: 0, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{title}</p>
      <p className="mz-small" style={{ margin: '4px 0 0', color: 'var(--vt-text-secondary)' }}>{body}</p>
    </div>
  );
}

/**
 * An empty result is far more useful when it names the facet responsible, so
 * the reader can undo one choice instead of starting over.
 */
function EmptyResult({
  filters,
  onClear,
}: {
  filters: BoardFilters;
  onClear: (key: keyof BoardFilters) => void;
}) {
  const active = activeFilterSummary(filters);

  if (active.length === 0) {
    return (
      <Note
        title="No roles posted yet"
        body="Employers publish roles here as they open them. Nothing is being withheld — there is simply nothing to show."
      />
    );
  }

  const narrowest = active[active.length - 1];

  return (
    <div className="border-l-2 py-3 pl-3" style={{ borderColor: RULE, marginTop: 20 }}>
      <p className="mz-small" style={{ margin: 0, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
        No roles match all {active.length} {active.length === 1 ? 'filter' : 'filters'}
      </p>
      <p className="mz-small" style={{ margin: '4px 0 8px', color: 'var(--vt-text-secondary)' }}>
        Removing one filter usually brings results back.
      </p>
      <button
        type="button"
        onClick={() => onClear(narrowest.key)}
        className="border px-2.5 py-1 text-[12px]"
        style={{ borderRadius: 3, borderColor: RULE_SOFT, color: 'var(--vt-text-primary)' }}
      >
        Remove “{narrowest.label}”
      </button>
    </div>
  );
}

export default BoardClient;
