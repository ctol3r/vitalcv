'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import type { OpportunityListPayload } from '@/lib/launch/marketplace';
import {
  type BoardFilters,
  EMPTY_BOARD_FILTERS,
  PAGE_SIZE,
  activeFilterSummary,
  clearFilter,
  hasActiveFilters,
  normalizeBoardFilters,
  parseBoardFilters,
  serializeBoardFilters,
  toApiQuery,
} from '@/lib/explore/board-filters';
import { BoardFilterPanel } from './BoardFilterPanel';
import { BoardPagination } from './BoardPagination';
import { BoardResultRow } from './BoardResultRow';

type LoadState = 'loading' | 'ready' | 'error';

export function BoardClient({ initial }: { initial: OpportunityListPayload }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseBoardFilters(searchParams), [searchParams]);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>(initial.opportunities);
  const [total, setTotal] = useState(initial.total);
  const [truncated, setTruncated] = useState(initial.truncated === true);
  const [state, setState] = useState<LoadState>(initial.available === false ? 'error' : 'ready');
  const hasHydrated = useRef(false);

  useEffect(() => setQueryDraft(filters.q), [filters.q]);

  const pushFilters = useCallback((next: BoardFilters) => {
    const params = serializeBoardFilters(next);
    const query = params.toString();
    router.replace(query ? `/explore?${query}` : '/explore', { scroll: false });
  }, [router]);

  const update = useCallback((patch: Partial<BoardFilters>) => {
    pushFilters(normalizeBoardFilters({ ...filters, ...patch, page: patch.page ?? 1 }));
  }, [filters, pushFilters]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (queryDraft !== filters.q) update({ q: queryDraft });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [filters.q, queryDraft, update]);

  const apiQuery = useMemo(() => toApiQuery(filters).toString(), [filters]);

  useEffect(() => {
    // The server already rendered this exact field. Keep those rows in place
    // instead of issuing a duplicate request that could erase useful content
    // during a transient proxy failure.
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState('loading');

    fetch(`/api/opportunities?${apiQuery}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Opportunity source unavailable');
        return payload as {
          opportunities?: OpportunitySummary[];
          total?: number;
          truncated?: boolean;
        };
      })
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload.opportunities) ? payload.opportunities : [];
        setOpportunities(rows);
        setTotal(typeof payload.total === 'number' ? payload.total : rows.length);
        setTruncated(payload.truncated === true);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setOpportunities([]);
        setTotal(0);
        setTruncated(false);
        setState('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiQuery]);

  const active = activeFilterSummary(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);

  return (
    <section className="opf-board" aria-labelledby="opportunity-field-title">
      <div className="opf-search-band">
        <label className="opf-search-label" htmlFor="opportunity-search">Search the field</label>
        <div className="opf-search-row">
          <input
            id="opportunity-search"
            type="search"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Role, clinician profession, specialty, or organization"
            className="opf-search-input"
          />
        </div>

        <details className="opf-filter-disclosure" open>
          <summary className="opf-filter-toggle">
            Filter roles{active.length > 0 ? ` · ${active.length}` : ''}
          </summary>
          <div className="opf-filters">
            <BoardFilterPanel filters={filters} onChange={update} />
          </div>
        </details>

        {active.length > 0 ? (
          <div className="opf-active-filters" aria-label="Active filters">
            {active.map(({ key, label }) => (
              <button
                key={String(key)}
                type="button"
                onClick={() => pushFilters(clearFilter(filters, key))}
                aria-label={`Remove filter ${label}`}
              >
                {label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" onClick={() => pushFilters(EMPTY_BOARD_FILTERS)}>
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      <div id="opportunity-results" className="opf-results-heading">
        <div>
          <p className="opf-kicker">Current source records</p>
          <h2 id="opportunity-field-title">The opportunity field</h2>
        </div>
        <p className="opf-result-count" aria-live="polite">
          {state === 'loading' ? 'Reading current sources…' : null}
          {state === 'error' ? 'Source unavailable' : null}
          {state === 'ready' ? `${total}${truncated ? '+' : ''} ${total === 1 ? 'role' : 'roles'}` : null}
        </p>
      </div>

      {truncated && state === 'ready' ? (
        <p className="opf-board-note">
          More roles match than this source window can count. Narrow the field to inspect the rest.
        </p>
      ) : null}

      {state === 'error' ? (
        <BoardNote
          title="The opportunity source could not be read"
          body="No role or profile state changed. Try again before acting on a listing."
        />
      ) : null}

      {state === 'ready' && opportunities.length === 0 ? (
        <BoardNote
          title={hasActiveFilters(filters) ? 'No roles match this field' : 'No current roles are available'}
          body={hasActiveFilters(filters)
            ? 'Remove a filter or broaden the search. VitalCV does not infer a match when the source has no result.'
            : 'The current sources returned no roles. Nothing is being withheld.'}
        />
      ) : null}

      {state === 'ready' ? (
        <div className="opf-role-list">
          {opportunities.map((opportunity, index) => (
            <BoardResultRow
              key={opportunity.id}
              opportunity={opportunity}
              ordinal={(currentPage - 1) * PAGE_SIZE + index + 1}
            />
          ))}
        </div>
      ) : null}

      {state === 'ready' && totalPages > 1 ? (
        <BoardPagination
          page={currentPage}
          totalPages={totalPages}
          onPage={(page) => {
            pushFilters(normalizeBoardFilters({ ...filters, page }));
            document.getElementById('opportunity-results')?.scrollIntoView();
          }}
        />
      ) : null}
    </section>
  );
}

function BoardNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="opf-board-note opf-board-note-strong" role="status">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export default BoardClient;
