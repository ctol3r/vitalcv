/**
 * URL state for the public opportunity field.
 *
 * These are browse facets, never a readiness or eligibility verdict. The API
 * owns filtering and pagination so a shared URL reproduces the same real set.
 */

export const PROFESSION_OPTIONS = [
  'physician',
  'advanced_practice',
  'nursing',
  'behavioral_health',
  'allied_health',
] as const;
export const SCHEDULE_OPTIONS = ['full_time', 'part_time', 'per_diem', 'flexible', 'not_stated'] as const;
export const HIRING_TYPE_OPTIONS = ['perm', 'locums', 'contract', 'telehealth'] as const;
export const OBSERVED_WITHIN_OPTIONS = ['1', '3', '7', '14', '30', '90'] as const;
export const APPLICATION_MODE_OPTIONS = ['external', 'vitalcv'] as const;
export const COMPENSATION_OPTIONS = ['supplied', 'not_supplied'] as const;
export const BENEFITS_OPTIONS = ['listed', 'limited', 'not_listed'] as const;
export const SORT_OPTIONS = ['recent', 'title', 'organization'] as const;

export const PAGE_SIZE = 12;

export interface BoardFilters {
  q: string;
  specialty: string;
  profession: string;
  state: string;
  schedule: string;
  hiringType: string;
  observedWithin: string;
  applicationMode: string;
  compensation: string;
  benefits: string;
  sort: string;
  /** null = any setting; true = remote; false = on-site or hybrid. */
  remote: boolean | null;
  page: number;
}

export interface SearchParamsReader {
  get(name: string): string | null;
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  q: '',
  specialty: '',
  profession: '',
  state: '',
  schedule: '',
  hiringType: '',
  observedWithin: '',
  applicationMode: '',
  compensation: '',
  benefits: '',
  sort: 'recent',
  remote: null,
  page: 1,
};

function text(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function oneOf(value: string | null | undefined, allowed: readonly string[]): string {
  const normalized = text(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : '';
}

function positiveInt(value: string | null | undefined): number {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseRemote(value: string | null | undefined): boolean | null {
  const normalized = text(value).toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

export function normalizeBoardFilters(filters: Partial<BoardFilters>): BoardFilters {
  return {
    q: text(filters.q).slice(0, 200),
    specialty: text(filters.specialty).slice(0, 120),
    profession: oneOf(filters.profession, PROFESSION_OPTIONS),
    state: text(filters.state).toUpperCase().slice(0, 2),
    schedule: oneOf(filters.schedule, SCHEDULE_OPTIONS),
    hiringType: oneOf(filters.hiringType, HIRING_TYPE_OPTIONS),
    observedWithin: oneOf(filters.observedWithin, OBSERVED_WITHIN_OPTIONS),
    applicationMode: oneOf(filters.applicationMode, APPLICATION_MODE_OPTIONS),
    compensation: oneOf(filters.compensation, COMPENSATION_OPTIONS),
    benefits: oneOf(filters.benefits, BENEFITS_OPTIONS),
    sort: oneOf(filters.sort, SORT_OPTIONS) || 'recent',
    remote: filters.remote === true || filters.remote === false ? filters.remote : null,
    page: filters.page && filters.page > 0 ? Math.floor(filters.page) : 1,
  };
}

export function parseBoardFilters(searchParams: SearchParamsReader): BoardFilters {
  return normalizeBoardFilters({
    q: searchParams.get('q') ?? '',
    specialty: searchParams.get('specialty') ?? '',
    profession: searchParams.get('profession') ?? '',
    state: searchParams.get('state') ?? '',
    schedule: searchParams.get('schedule') ?? '',
    hiringType: searchParams.get('hiringType') ?? '',
    observedWithin: searchParams.get('observedWithin') ?? '',
    applicationMode: searchParams.get('applicationMode') ?? '',
    compensation: searchParams.get('compensation') ?? '',
    benefits: searchParams.get('benefits') ?? '',
    sort: searchParams.get('sort') ?? 'recent',
    remote: parseRemote(searchParams.get('remote')),
    page: positiveInt(searchParams.get('page')),
  });
}

export function serializeBoardFilters(filters: Partial<BoardFilters>): URLSearchParams {
  const f = normalizeBoardFilters(filters);
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.specialty) params.set('specialty', f.specialty);
  if (f.profession) params.set('profession', f.profession);
  if (f.state) params.set('state', f.state);
  if (f.schedule) params.set('schedule', f.schedule);
  if (f.hiringType) params.set('hiringType', f.hiringType);
  if (f.observedWithin) params.set('observedWithin', f.observedWithin);
  if (f.applicationMode) params.set('applicationMode', f.applicationMode);
  if (f.compensation) params.set('compensation', f.compensation);
  if (f.benefits) params.set('benefits', f.benefits);
  if (f.sort !== 'recent') params.set('sort', f.sort);
  if (f.remote !== null) params.set('remote', String(f.remote));
  if (f.page > 1) params.set('page', String(f.page));
  return params;
}

export function toApiQuery(filters: Partial<BoardFilters>): URLSearchParams {
  const f = normalizeBoardFilters(filters);
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.specialty) params.set('specialty', f.specialty);
  if (f.profession) params.set('profession', f.profession);
  if (f.state) params.set('state', f.state);
  if (f.schedule) params.set('schedule', f.schedule);
  if (f.hiringType) params.set('hiringType', f.hiringType);
  if (f.observedWithin) params.set('observedWithinDays', f.observedWithin);
  if (f.applicationMode) params.set('applicationMode', f.applicationMode);
  if (f.compensation) params.set('compensation', f.compensation);
  if (f.benefits) params.set('benefits', f.benefits);
  params.set('sort', f.sort);
  if (f.remote !== null) params.set('remote', String(f.remote));
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String((f.page - 1) * PAGE_SIZE));
  return params;
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  const f = normalizeBoardFilters(filters);
  return Boolean(
    f.q || f.specialty || f.profession || f.state || f.schedule
    || f.hiringType || f.remote !== null || f.observedWithin || f.applicationMode
    || f.compensation || f.benefits,
  );
}

export function activeFilterSummary(filters: BoardFilters): Array<{ key: keyof BoardFilters; label: string }> {
  const f = normalizeBoardFilters(filters);
  const out: Array<{ key: keyof BoardFilters; label: string }> = [];
  if (f.q) out.push({ key: 'q', label: `“${f.q}”` });
  if (f.specialty) out.push({ key: 'specialty', label: f.specialty });
  if (f.profession) out.push({ key: 'profession', label: PROFESSION_LABEL[f.profession] ?? f.profession });
  if (f.state) out.push({ key: 'state', label: f.state });
  if (f.remote === true) out.push({ key: 'remote', label: 'Remote' });
  if (f.remote === false) out.push({ key: 'remote', label: 'On-site or hybrid' });
  if (f.schedule) out.push({ key: 'schedule', label: SCHEDULE_LABEL[f.schedule] ?? f.schedule });
  if (f.hiringType) out.push({ key: 'hiringType', label: HIRING_TYPE_LABEL[f.hiringType] ?? f.hiringType });
  if (f.observedWithin) out.push({
    key: 'observedWithin',
    label: `Source observed within ${f.observedWithin} ${f.observedWithin === '1' ? 'day' : 'days'}`,
  });
  if (f.applicationMode) out.push({
    key: 'applicationMode',
    label: APPLICATION_MODE_LABEL[f.applicationMode] ?? f.applicationMode,
  });
  if (f.compensation) out.push({
    key: 'compensation',
    label: COMPENSATION_LABEL[f.compensation] ?? f.compensation,
  });
  if (f.benefits) out.push({ key: 'benefits', label: BENEFITS_LABEL[f.benefits] ?? f.benefits });
  return out;
}

export function clearFilter(filters: BoardFilters, key: keyof BoardFilters): BoardFilters {
  return normalizeBoardFilters({
    ...filters,
    [key]: EMPTY_BOARD_FILTERS[key],
    page: 1,
  } as Partial<BoardFilters>);
}

/**
 * Keep a shared or stale page URL inside the current result set. Returning
 * null means no navigation is needed; a number means the caller must replace
 * the URL and refetch that page before presenting an empty-result state.
 */
export function clampedBoardPage(page: number, total: number): number | null {
  const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  return page > lastPage ? lastPage : null;
}

export const PROFESSION_LABEL: Record<string, string> = {
  physician: 'Physicians',
  advanced_practice: 'Advanced practice',
  nursing: 'Nursing',
  behavioral_health: 'Behavioral health',
  allied_health: 'Allied health',
  not_stated: 'Profession not stated',
};

export const SCHEDULE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  per_diem: 'Per diem / PRN',
  flexible: 'Flexible',
  not_stated: 'Schedule not stated',
};

export const HIRING_TYPE_LABEL: Record<string, string> = {
  perm: 'Permanent',
  locums: 'Locums',
  contract: 'Contract',
  telehealth: 'Telehealth',
};

export const OBSERVED_WITHIN_LABEL: Record<string, string> = {
  '1': 'Past day',
  '3': 'Past 3 days',
  '7': 'Past week',
  '14': 'Past 2 weeks',
  '30': 'Past month',
  '90': 'Past 3 months',
};

export const APPLICATION_MODE_LABEL: Record<string, string> = {
  external: 'Original listing',
  vitalcv: 'Apply with VitalCV',
};

export const COMPENSATION_LABEL: Record<string, string> = {
  supplied: 'Compensation supplied',
  not_supplied: 'Compensation not supplied',
};

export const BENEFITS_LABEL: Record<string, string> = {
  listed: 'Benefits listed',
  limited: 'Limited benefits detail',
  not_listed: 'Benefits not listed',
};

export const SORT_LABEL: Record<string, string> = {
  recent: 'Most recently updated',
  title: 'Role title A–Z',
  organization: 'Organization A–Z',
};
