/**
 * board-query — keyword matching, sorting and paging over an already-fetched
 * result set.
 *
 * TRANSITIONAL. The opportunity service has no full-text index and no SQL-level
 * ordering beyond `updatedAt` today, so the board fetches the matching set and
 * finishes the job here. That is correct only while the whole matching set fits
 * in one response, which is why `applyBoardQuery` reports `truncated` — the
 * caller must not print a total it cannot stand behind.
 *
 * When the Postgres FTS migration lands, `matchesKeyword` and `sortResults`
 * move into SQL and this module goes away. Keep the ranking rules here readable
 * so they can be translated into `ts_rank` weights rather than reinvented.
 */

import type { OpportunitySummary } from '@/lib/launch/marketplace';
import type { BoardFilters, BoardSort } from './board-filters';
import { PAGE_SIZE } from './board-filters';

/** Split a query into terms, honouring "quoted phrases" as single terms. */
export function parseKeywordTerms(query: string): string[] {
  const terms: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(query)) !== null) {
    const term = (match[1] ?? match[2] ?? '').trim().toLowerCase();
    if (term) terms.push(term);
  }

  return terms;
}

function haystack(opportunity: OpportunitySummary): string {
  return [
    opportunity.title,
    opportunity.specialty,
    opportunity.organizationName,
    opportunity.description ?? '',
    opportunity.employerType ?? '',
    ...(opportunity.credentialRequirements ?? []).map((r) => r.label),
  ].join(' ').toLowerCase();
}

/** Every term must appear somewhere — AND semantics, which is what people expect. */
export function matchesKeyword(opportunity: OpportunitySummary, query: string): boolean {
  const terms = parseKeywordTerms(query);
  if (terms.length === 0) return true;
  const text = haystack(opportunity);
  return terms.every((term) => text.includes(term));
}

/**
 * Relevance score. Title and specialty hits outrank body hits, mirroring the
 * A/B/C/D weighting a `ts_rank` setweight() would apply later.
 */
export function relevanceScore(opportunity: OpportunitySummary, query: string): number {
  const terms = parseKeywordTerms(query);
  if (terms.length === 0) return 0;

  const title = opportunity.title.toLowerCase();
  const specialty = (opportunity.specialty ?? '').toLowerCase();
  const org = (opportunity.organizationName ?? '').toLowerCase();
  const body = (opportunity.description ?? '').toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (specialty.includes(term)) score += 5;
    if (org.includes(term)) score += 3;
    if (body.includes(term)) score += 1;
  }
  return score;
}

function timestamp(value: string | undefined | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Highest advertised pay, used only for the pay sort. */
function payCeiling(opportunity: OpportunitySummary): number | null {
  const max = opportunity.payRangeMax ?? null;
  const min = opportunity.payRangeMin ?? null;
  const value = max ?? min;
  if (value == null) return null;
  // An hourly figure and an annual figure are not comparable; normalise the
  // hourly ones to a nominal full-time year so one list can be ordered.
  if (opportunity.payUnit === 'hour') return value * 2080;
  if (opportunity.payUnit === 'shift') return value * 240;
  return value;
}

export function sortResults(
  results: OpportunitySummary[],
  sort: BoardSort,
  query: string,
): OpportunitySummary[] {
  const sorted = [...results];

  switch (sort) {
    case 'newest':
      sorted.sort((a, b) => timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt));
      break;

    case 'fastest_start':
      // Unknown start speed sorts last rather than pretending to be fast.
      sorted.sort((a, b) => {
        const left = a.speedToStartDays ?? Number.POSITIVE_INFINITY;
        const right = b.speedToStartDays ?? Number.POSITIVE_INFINITY;
        if (left === right) return timestamp(b.updatedAt) - timestamp(a.updatedAt);
        return left - right;
      });
      break;

    case 'pay':
      // Roles with no published pay sort last — ranking them as $0 would punish
      // employers for withholding a number, and ranking them high would invent one.
      sorted.sort((a, b) => {
        const left = payCeiling(a);
        const right = payCeiling(b);
        if (left == null && right == null) return timestamp(b.updatedAt) - timestamp(a.updatedAt);
        if (left == null) return 1;
        if (right == null) return -1;
        return right - left;
      });
      break;

    case 'relevance':
    default:
      if (query.trim()) {
        sorted.sort((a, b) => {
          const delta = relevanceScore(b, query) - relevanceScore(a, query);
          if (delta !== 0) return delta;
          return timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt);
        });
      } else {
        // With no query there is nothing to be relevant to — most recently
        // updated is the honest default, not an arbitrary "relevance" order.
        sorted.sort((a, b) => timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt));
      }
      break;
  }

  return sorted;
}

export interface BoardQueryResult {
  /** The page the viewer is looking at. */
  page: OpportunitySummary[];
  /** Total rows matching the whole query, across all pages. */
  matched: number;
  totalPages: number;
  /**
   * True when the service reported more matching rows than it returned, so
   * `matched` is a floor rather than a count. The board must say so.
   */
  truncated: boolean;
}

/**
 * Apply the client-side half of the query: keyword, the onsite-only case the
 * service cannot express, then sort and page.
 */
export function applyBoardQuery(
  fetched: OpportunitySummary[],
  filters: BoardFilters,
  serviceTotal: number,
): BoardQueryResult {
  let results = fetched;

  // The service narrows on `remote=true` only, so onsite-only is finished here.
  if (filters.remote === false) {
    results = results.filter((o) => !o.remote);
  }

  if (filters.q.trim()) {
    results = results.filter((o) => matchesKeyword(o, filters.q));
  }

  results = sortResults(results, filters.sort, filters.q);

  const matched = results.length;
  const totalPages = Math.max(1, Math.ceil(matched / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);
  const start = (page - 1) * PAGE_SIZE;

  return {
    page: results.slice(start, start + PAGE_SIZE),
    matched,
    totalPages,
    truncated: serviceTotal > fetched.length,
  };
}
