/**
 * board-filters — URL state for the public opportunities board.
 *
 * The URL is the single source of truth: every facet, the sort, and the page
 * live in the query string, so a filtered view is shareable and survives a
 * reload. This replaces the fifteen separate `useState` hooks and the manual
 * re-sync effect in the retired ExploreClient.
 *
 * Shape follows the house pattern in lib/intelligence/finding-filters.ts —
 * parse / normalize / serialize over one plain object.
 */

export const SORT_OPTIONS = ['relevance', 'newest', 'fastest_start', 'pay'] as const;
export type BoardSort = (typeof SORT_OPTIONS)[number];

export const PAY_MODEL_OPTIONS = ['salary', 'hourly', 'locums', 'shift'] as const;
export const VISA_OPTIONS = ['available', 'case_by_case', 'not_available', 'not_stated'] as const;
export const BENEFIT_OPTIONS = ['listed', 'limited', 'not_listed'] as const;
export const START_URGENCY_OPTIONS = ['immediate', 'within_2_weeks', 'within_month', 'flexible'] as const;
export const READINESS_OPTIONS = ['ready_now', 'needs_review', 'requirements_missing'] as const;
export const HIRING_TYPE_OPTIONS = ['perm', 'locums', 'telehealth', 'contract'] as const;

/** Results per page. Matches the density of a single-column ruled list. */
export const PAGE_SIZE = 25;

export interface BoardFilters {
  /** Free-text keyword. Matched against title, specialty, description, employer. */
  q: string;
  specialty: string;
  state: string;
  hiringType: string;
  organizationSlug: string;
  /** Tri-state: null = any, true = remote only, false = onsite only. */
  remote: boolean | null;
  payModel: string;
  payMin: string;
  payMax: string;
  visaSponsorship: string;
  benefits: string;
  employerType: string;
  startUrgency: string;
  /** Requires a resolved clinician NPI — the signed-in-only facets. */
  readinessStatus: string;
  missingRequirement: string;
  sort: BoardSort;
  page: number;
}

export interface SearchParamsReader {
  get(name: string): string | null;
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  q: '',
  specialty: '',
  state: '',
  hiringType: '',
  organizationSlug: '',
  remote: null,
  payModel: '',
  payMin: '',
  payMax: '',
  visaSponsorship: '',
  benefits: '',
  employerType: '',
  startUrgency: '',
  readinessStatus: '',
  missingRequirement: '',
  sort: 'relevance',
  page: 1,
};

function oneOf(value: string | null | undefined, allowed: readonly string[]): string {
  const trimmed = (value ?? '').trim().toLowerCase();
  return allowed.includes(trimmed) ? trimmed : '';
}

function text(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Positive integers only; anything else falls back so the query can't be poisoned. */
function positiveInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function money(value: string | null | undefined): string {
  const raw = (value ?? '').trim().replace(/[$,\s]/g, '');
  if (!raw) return '';
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return '';
  return String(Math.round(parsed));
}

function parseRemote(value: string | null | undefined): boolean | null {
  const trimmed = (value ?? '').trim().toLowerCase();
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;
  return null;
}

export function normalizeBoardFilters(filters: Partial<BoardFilters>): BoardFilters {
  const payMin = money(filters.payMin);
  const payMax = money(filters.payMax);

  const normalized: BoardFilters = {
    q: text(filters.q).slice(0, 200),
    specialty: text(filters.specialty),
    state: text(filters.state).toUpperCase().slice(0, 2),
    hiringType: oneOf(filters.hiringType, HIRING_TYPE_OPTIONS),
    organizationSlug: text(filters.organizationSlug),
    remote: filters.remote === true || filters.remote === false ? filters.remote : null,
    payModel: oneOf(filters.payModel, PAY_MODEL_OPTIONS),
    payMin,
    payMax,
    visaSponsorship: oneOf(filters.visaSponsorship, VISA_OPTIONS),
    benefits: oneOf(filters.benefits, BENEFIT_OPTIONS),
    employerType: text(filters.employerType),
    startUrgency: oneOf(filters.startUrgency, START_URGENCY_OPTIONS),
    readinessStatus: oneOf(filters.readinessStatus, READINESS_OPTIONS),
    missingRequirement: text(filters.missingRequirement),
    sort: SORT_OPTIONS.includes(filters.sort as BoardSort) ? (filters.sort as BoardSort) : 'relevance',
    page: filters.page && filters.page > 0 ? Math.floor(filters.page) : 1,
  };

  // A reversed pay range filters out everything, which reads as a broken board
  // rather than as user error. Swap instead.
  if (normalized.payMin && normalized.payMax
    && Number.parseFloat(normalized.payMin) > Number.parseFloat(normalized.payMax)) {
    return { ...normalized, payMin: normalized.payMax, payMax: normalized.payMin };
  }

  return normalized;
}

export function parseBoardFilters(searchParams: SearchParamsReader): BoardFilters {
  return normalizeBoardFilters({
    q: searchParams.get('q') ?? '',
    specialty: searchParams.get('specialty') ?? '',
    state: searchParams.get('state') ?? '',
    hiringType: searchParams.get('hiringType') ?? '',
    organizationSlug: searchParams.get('organizationSlug') ?? '',
    remote: parseRemote(searchParams.get('remote')),
    payModel: searchParams.get('payModel') ?? '',
    payMin: searchParams.get('payMin') ?? '',
    payMax: searchParams.get('payMax') ?? '',
    visaSponsorship: searchParams.get('visaSponsorship') ?? '',
    benefits: searchParams.get('benefits') ?? '',
    employerType: searchParams.get('employerType') ?? '',
    startUrgency: searchParams.get('startUrgency') ?? '',
    readinessStatus: searchParams.get('readinessStatus') ?? '',
    missingRequirement: searchParams.get('missingRequirement') ?? '',
    sort: (searchParams.get('sort') ?? '') as BoardSort,
    page: positiveInt(searchParams.get('page'), 1),
  });
}

/**
 * Query string for the address bar. Defaults are omitted so a clean board has a
 * clean URL and `/explore` stays canonical for sharing and for the crawler.
 */
export function serializeBoardFilters(filters: Partial<BoardFilters>): URLSearchParams {
  const f = normalizeBoardFilters(filters);
  const params = new URLSearchParams();

  if (f.q) params.set('q', f.q);
  if (f.specialty) params.set('specialty', f.specialty);
  if (f.state) params.set('state', f.state);
  if (f.hiringType) params.set('hiringType', f.hiringType);
  if (f.organizationSlug) params.set('organizationSlug', f.organizationSlug);
  if (f.remote !== null) params.set('remote', String(f.remote));
  if (f.payModel) params.set('payModel', f.payModel);
  if (f.payMin) params.set('payMin', f.payMin);
  if (f.payMax) params.set('payMax', f.payMax);
  if (f.visaSponsorship) params.set('visaSponsorship', f.visaSponsorship);
  if (f.benefits) params.set('benefits', f.benefits);
  if (f.employerType) params.set('employerType', f.employerType);
  if (f.startUrgency) params.set('startUrgency', f.startUrgency);
  if (f.readinessStatus) params.set('readinessStatus', f.readinessStatus);
  if (f.missingRequirement) params.set('missingRequirement', f.missingRequirement);
  if (f.sort !== 'relevance') params.set('sort', f.sort);
  if (f.page > 1) params.set('page', String(f.page));

  return params;
}

/**
 * Query string for GET /api/opportunities.
 *
 * Only the parameters the backend actually understands today. `q` and `sort`
 * are deliberately NOT sent — the service has no full-text index yet, so they
 * are applied over the fetched set by `applyBoardQuery` until the Postgres FTS
 * migration lands and moves them into SQL.
 */
export function toApiQuery(filters: Partial<BoardFilters>, options?: { limit?: number; npi?: string }): URLSearchParams {
  const f = normalizeBoardFilters(filters);
  const params = new URLSearchParams();

  if (f.specialty) params.set('specialty', f.specialty);
  if (f.state) params.set('state', f.state);
  if (f.hiringType) params.set('hiringType', f.hiringType);
  if (f.organizationSlug) params.set('organizationSlug', f.organizationSlug);
  // The service only narrows on `remote=true`; onsite-only is resolved client-side.
  if (f.remote === true) params.set('remote', 'true');
  if (f.payModel) params.set('payModel', f.payModel);
  if (f.payMin) params.set('payMin', f.payMin);
  if (f.payMax) params.set('payMax', f.payMax);
  if (f.visaSponsorship) params.set('visaSponsorship', f.visaSponsorship);
  if (f.benefits) params.set('benefits', f.benefits);
  if (f.employerType) params.set('employerType', f.employerType);
  if (f.startUrgency) params.set('startUrgency', f.startUrgency);
  if (f.readinessStatus) params.set('readinessStatus', f.readinessStatus);
  if (f.missingRequirement) params.set('missingRequirement', f.missingRequirement);
  if (options?.npi) params.set('npi', options.npi);

  params.set('limit', String(options?.limit ?? 500));
  params.set('offset', '0');

  return params;
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  const f = normalizeBoardFilters(filters);
  return Boolean(
    f.q || f.specialty || f.state || f.hiringType || f.organizationSlug
    || f.remote !== null || f.payModel || f.payMin || f.payMax
    || f.visaSponsorship || f.benefits || f.employerType || f.startUrgency
    || f.readinessStatus || f.missingRequirement,
  );
}

/** Human-readable label per active facet, for the "clear this one" chips row. */
export function activeFilterSummary(filters: BoardFilters): Array<{ key: keyof BoardFilters; label: string }> {
  const f = normalizeBoardFilters(filters);
  const out: Array<{ key: keyof BoardFilters; label: string }> = [];

  if (f.q) out.push({ key: 'q', label: `“${f.q}”` });
  if (f.specialty) out.push({ key: 'specialty', label: f.specialty });
  if (f.state) out.push({ key: 'state', label: f.state });
  if (f.hiringType) out.push({ key: 'hiringType', label: HIRING_TYPE_LABEL[f.hiringType] ?? f.hiringType });
  if (f.organizationSlug) out.push({ key: 'organizationSlug', label: f.organizationSlug });
  if (f.remote === true) out.push({ key: 'remote', label: 'Remote' });
  if (f.remote === false) out.push({ key: 'remote', label: 'Onsite' });
  if (f.payModel) out.push({ key: 'payModel', label: PAY_MODEL_LABEL[f.payModel] ?? f.payModel });
  if (f.payMin) out.push({ key: 'payMin', label: `Min ${formatMoney(f.payMin)}` });
  if (f.payMax) out.push({ key: 'payMax', label: `Max ${formatMoney(f.payMax)}` });
  if (f.visaSponsorship) out.push({ key: 'visaSponsorship', label: VISA_LABEL[f.visaSponsorship] ?? f.visaSponsorship });
  if (f.benefits) out.push({ key: 'benefits', label: BENEFIT_LABEL[f.benefits] ?? f.benefits });
  if (f.employerType) out.push({ key: 'employerType', label: f.employerType });
  if (f.startUrgency) out.push({ key: 'startUrgency', label: START_URGENCY_LABEL[f.startUrgency] ?? f.startUrgency });
  if (f.readinessStatus) out.push({ key: 'readinessStatus', label: READINESS_LABEL[f.readinessStatus] ?? f.readinessStatus });
  if (f.missingRequirement) out.push({ key: 'missingRequirement', label: `Missing: ${f.missingRequirement}` });

  return out;
}

/** Reset one facet to its empty value without disturbing the rest. */
export function clearFilter(filters: BoardFilters, key: keyof BoardFilters): BoardFilters {
  return normalizeBoardFilters({
    ...filters,
    [key]: EMPTY_BOARD_FILTERS[key],
    page: 1,
  } as Partial<BoardFilters>);
}

export function formatMoney(value: string | number | null | undefined): string {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return '';
  return `$${Math.round(parsed).toLocaleString('en-US')}`;
}

export const HIRING_TYPE_LABEL: Record<string, string> = {
  perm: 'Permanent',
  locums: 'Locums',
  telehealth: 'Telehealth',
  contract: 'Contract',
};

export const PAY_MODEL_LABEL: Record<string, string> = {
  salary: 'Salary',
  hourly: 'Hourly',
  locums: 'Locums rate',
  shift: 'Per shift',
};

export const VISA_LABEL: Record<string, string> = {
  available: 'Sponsorship available',
  case_by_case: 'Sponsorship case by case',
  not_available: 'No sponsorship',
  not_stated: 'Sponsorship not stated',
};

export const BENEFIT_LABEL: Record<string, string> = {
  listed: 'Benefits listed',
  limited: 'Some benefits listed',
  not_listed: 'Benefits not listed',
};

export const START_URGENCY_LABEL: Record<string, string> = {
  immediate: 'Start immediately',
  within_2_weeks: 'Within 2 weeks',
  within_month: 'Within a month',
  flexible: 'Flexible start',
};

export const READINESS_LABEL: Record<string, string> = {
  ready_now: 'Ready now',
  needs_review: 'Needs review',
  requirements_missing: 'Requirements missing',
};

export const SORT_LABEL: Record<BoardSort, string> = {
  relevance: 'Relevance',
  newest: 'Newest',
  fastest_start: 'Fastest start',
  pay: 'Pay',
};
