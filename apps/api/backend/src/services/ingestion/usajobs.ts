/**
 * USAJOBS connector.
 *
 * The VA is the largest healthcare employer in the United States and USAJOBS
 * publishes its clinical vacancies through an official, free API, which is why
 * this is the first feed: the postings are real clinical roles held by licensed
 * clinicians, which is the only kind of inventory the readiness facet can ever
 * mean anything against.
 *
 * Relevance is gated at the SOURCE using federal occupational series codes
 * rather than by pattern-matching job titles. "Medical Officer" (0602) and
 * "Nurse" (0610) are what the employer filed the vacancy under; a title regex
 * would be our guess about someone else's job, and would quietly pull in
 * administrative roles that have no licence to match.
 *
 * Requires USAJOBS_API_KEY and USAJOBS_USER_AGENT (the email registered with
 * USAJOBS). Absent either, the connector reports itself unconfigured — it does
 * NOT return an empty list, because "no jobs today" and "we never asked" must
 * never look the same to an operator.
 */

import type { FeedConnector, FeedFetchResult, FeedListing } from './types';
import { STATE_NAME_TO_CODE } from './usStates';

const USAJOBS_HOST = 'data.usajobs.gov';
const SEARCH_URL = `https://${USAJOBS_HOST}/api/search`;

/**
 * Federal occupational series that correspond to licence-bearing clinical work.
 * Deliberately narrow: every code here describes someone whose credentials
 * VitalCV can actually reason about.
 */
export const CLINICAL_SERIES_CODES = [
  '0602', // Medical Officer (physicians)
  '0603', // Physician Assistant
  '0610', // Nurse
  '0180', // Psychology
  '0631', // Occupational Therapist
  '0633', // Physical Therapist
  '0644', // Medical Technologist
  '0660', // Pharmacist
  '0680', // Dental Officer
] as const;

interface UsaJobsRemuneration {
  MinimumRange?: string;
  MaximumRange?: string;
  RateIntervalCode?: string;
}

interface UsaJobsLocation {
  LocationName?: string;
  CountrySubDivisionCode?: string;
}

export interface UsaJobsDescriptor {
  PositionID?: string;
  PositionTitle?: string;
  PositionURI?: string;
  OrganizationName?: string;
  DepartmentName?: string;
  PositionLocation?: UsaJobsLocation[];
  PositionRemuneration?: UsaJobsRemuneration[];
  JobCategory?: Array<{ Name?: string; Code?: string }>;
  PublicationStartDate?: string;
  UserArea?: { Details?: { JobSummary?: string } };
}

export interface UsaJobsSearchResponse {
  SearchResult?: {
    /** Items on THIS page. */
    SearchResultCount?: number;
    /** Items matching the whole query, across all pages. */
    SearchResultCountAll?: number;
    SearchResultItems?: Array<{ MatchedObjectDescriptor?: UsaJobsDescriptor }>;
  };
}

/**
 * USAJOBS reports locations as "Palo Alto, California", so the state arrives as
 * a name rather than the two-letter code the Opportunity column stores.
 */

/** Two-letter state code, or null. USAJOBS gives "Palo Alto, California". */
function extractState(locations: UsaJobsLocation[] | undefined): string | null {
  for (const location of locations ?? []) {
    const code = location.CountrySubDivisionCode?.trim();
    // The field is a full state NAME in practice, so map it; a two-letter value
    // is taken as already-a-code.
    if (code && code.length === 2 && /^[A-Z]{2}$/i.test(code)) {
      return code.toUpperCase();
    }
    if (code && STATE_NAME_TO_CODE[code.toLowerCase()]) {
      return STATE_NAME_TO_CODE[code.toLowerCase()];
    }
    const name = location.LocationName ?? '';
    const tail = name.split(',').pop()?.trim().toLowerCase() ?? '';
    if (STATE_NAME_TO_CODE[tail]) {
      return STATE_NAME_TO_CODE[tail];
    }
  }
  return null;
}

/**
 * Salary, only when the feed gives a real annual figure.
 *
 * RateIntervalCode distinguishes "Per Year" from "Per Hour"; mixing them would
 * put an hourly rate into a column the board reads as annual, so anything that
 * is not clearly annual is dropped rather than converted with an assumed
 * full-time year.
 */
function extractPay(remuneration: UsaJobsRemuneration[] | undefined): { min: number | null; max: number | null } {
  for (const entry of remuneration ?? []) {
    const interval = (entry.RateIntervalCode ?? '').toLowerCase();
    if (!interval.includes('year') && interval !== 'py' && interval !== 'pa') {
      continue;
    }
    const min = Number.parseFloat(entry.MinimumRange ?? '');
    const max = Number.parseFloat(entry.MaximumRange ?? '');
    return {
      min: Number.isFinite(min) && min > 0 ? Math.round(min) : null,
      max: Number.isFinite(max) && max > 0 ? Math.round(max) : null,
    };
  }
  return { min: null, max: null };
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Strip the HTML USAJOBS embeds in job summaries. */
function toPlainText(value: string | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text.slice(0, 4000) : null;
}

/**
 * One search result → one FeedListing, or null when the feed omitted something
 * a listing cannot be honest without.
 *
 * Pure and exported so the mapping can be tested without a credential or a
 * network call — which matters, because the connector cannot run until the key
 * is set and the mapping would otherwise ship unverified.
 */
export function normalizeUsaJobsItem(descriptor: UsaJobsDescriptor | undefined): FeedListing | null {
  if (!descriptor) return null;

  const sourceRef = descriptor.PositionID?.trim();
  const title = descriptor.PositionTitle?.trim();
  const sourceUrl = descriptor.PositionURI?.trim();
  // The employer name and a link back are non-negotiable: without them a reader
  // cannot tell who is hiring or go check the posting themselves.
  const organizationName = (descriptor.OrganizationName ?? descriptor.DepartmentName)?.trim();

  if (!sourceRef || !title || !sourceUrl || !organizationName) {
    return null;
  }

  const pay = extractPay(descriptor.PositionRemuneration);

  return {
    sourceRef,
    sourceUrl,
    title,
    organizationName,
    state: extractState(descriptor.PositionLocation),
    // USAJOBS models telework separately from the vacancy record returned here;
    // claiming remote without a field that says so would be an invention.
    remote: false,
    description: toPlainText(descriptor.UserArea?.Details?.JobSummary),
    // The occupational series NAME is the employer's own classification of the
    // role, so it is a stated specialty rather than a guess from the title.
    specialty: descriptor.JobCategory?.[0]?.Name?.trim() || null,
    profession: null,
    payMin: pay.min,
    payMax: pay.max,
    postedAt: parseDate(descriptor.PublicationStartDate),
  };
}

export class UsaJobsConnector implements FeedConnector {
  readonly feed = 'usajobs';

  private get apiKey(): string {
    return (process.env.USAJOBS_API_KEY ?? '').trim();
  }

  private get userAgent(): string {
    return (process.env.USAJOBS_USER_AGENT ?? '').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0 && this.userAgent.length > 0;
  }

  configurationHint(): string {
    const missing: string[] = [];
    if (this.apiKey.length === 0) missing.push('USAJOBS_API_KEY');
    if (this.userAgent.length === 0) missing.push('USAJOBS_USER_AGENT');
    return missing.length > 0
      ? `Set ${missing.join(' and ')} (register free at developer.usajobs.gov).`
      : '';
  }

  async fetch({ limit }: { limit: number }): Promise<FeedFetchResult> {
    if (!this.isConfigured()) {
      // Fail loudly. An empty array here would be indistinguishable from a feed
      // that genuinely returned nothing.
      throw new Error(`USAJOBS connector is not configured. ${this.configurationHint()}`);
    }

    const params = new URLSearchParams({
      JobCategoryCode: CLINICAL_SERIES_CODES.join(';'),
      ResultsPerPage: String(Math.min(Math.max(limit, 1), 500)),
      Page: '1',
    });

    const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: {
        Host: USAJOBS_HOST,
        'User-Agent': this.userAgent,
        'Authorization-Key': this.apiKey,
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`USAJOBS search failed: HTTP ${response.status}`);
    }

    const payload = await response.json() as UsaJobsSearchResponse;
    const items = payload.SearchResult?.SearchResultItems ?? [];

    const listings = items
      .map((item) => normalizeUsaJobsItem(item.MatchedObjectDescriptor))
      .filter((listing): listing is FeedListing => listing !== null);

    /**
     * This run saw the whole feed only if USAJOBS says the total matching the
     * query is no larger than the page we asked for. This connector reads a
     * single page, so anything beyond `limit` is unseen and expiry must not
     * conclude those postings are gone.
     *
     * `SearchResultCountAll` missing is treated as incomplete: an absent count
     * is not evidence of a small result set.
     */
    const totalMatching = payload.SearchResult?.SearchResultCountAll;
    const complete = typeof totalMatching === 'number' && totalMatching <= items.length;

    return { listings, complete };
  }
}
