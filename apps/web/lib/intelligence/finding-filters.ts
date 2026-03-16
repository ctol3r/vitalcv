export const FINDING_SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'info'] as const;
export const FINDING_STATUS_OPTIONS = ['new', 'acknowledged', 'investigating', 'dismissed', 'resolved'] as const;

export interface FindingFiltersState {
  severity: string[];
  type: string[];
  status: string[];
  dateFrom: string;
  dateTo: string;
  minConfidence: string;
}

export interface SearchParamsReader {
  get(name: string): string | null;
}

export const EMPTY_FINDING_FILTERS: FindingFiltersState = {
  severity: [],
  type: [],
  status: [],
  dateFrom: '',
  dateTo: '',
  minConfidence: '',
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function unique(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function sortList(values: string[], orderedValues?: readonly string[]) {
  if (!orderedValues || orderedValues.length === 0) {
    return [...values].sort((left, right) => left.localeCompare(right));
  }

  return [...values].sort((left, right) => {
    const leftIndex = orderedValues.indexOf(left);
    const rightIndex = orderedValues.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export function parseFindingFilterList(value: string | null | undefined, orderedValues?: readonly string[]) {
  if (!value) {
    return [];
  }

  return sortList(
    unique(
      value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
    orderedValues,
  );
}

function normalizeDateValue(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  if (DATE_ONLY_RE.test(value)) {
    return value;
  }

  const trimmed = value.slice(0, 10);
  return DATE_ONLY_RE.test(trimmed) ? trimmed : '';
}

function normalizeMinConfidenceValue(value: string | number | null | undefined) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return '';
  }

  const bounded = Math.max(0, Math.min(parsed, 1));
  return Number.parseFloat(bounded.toFixed(2)).toString();
}

function normalizeStatusValue(value: string) {
  return value === 'escalated' ? 'investigating' : value;
}

export function normalizeFindingFilters(filters: Partial<FindingFiltersState>): FindingFiltersState {
  const dateFrom = normalizeDateValue(filters.dateFrom);
  const dateTo = normalizeDateValue(filters.dateTo);

  const normalized = {
    severity: sortList(unique((filters.severity ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)), FINDING_SEVERITY_OPTIONS),
    type: sortList(unique((filters.type ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))),
    status: sortList(
      unique((filters.status ?? [])
        .map((value) => normalizeStatusValue(value.trim().toLowerCase()))
        .filter(Boolean)),
      FINDING_STATUS_OPTIONS,
    ),
    dateFrom,
    dateTo,
    minConfidence: normalizeMinConfidenceValue(filters.minConfidence),
  } satisfies FindingFiltersState;

  if (normalized.dateFrom && normalized.dateTo && normalized.dateFrom > normalized.dateTo) {
    return {
      ...normalized,
      dateFrom: normalized.dateTo,
      dateTo: normalized.dateFrom,
    };
  }

  return normalized;
}

export function parseFindingFilters(searchParams: SearchParamsReader): FindingFiltersState {
  return normalizeFindingFilters({
    severity: parseFindingFilterList(searchParams.get('severity'), FINDING_SEVERITY_OPTIONS),
    type: parseFindingFilterList(searchParams.get('type') ?? searchParams.get('findingType')),
    status: parseFindingFilterList(searchParams.get('status'), FINDING_STATUS_OPTIONS),
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    minConfidence: searchParams.get('minConfidence') ?? '',
  });
}

export function serializeFindingFilters(filters: FindingFiltersState, options?: { page?: number }) {
  const normalized = normalizeFindingFilters(filters);
  const params = new URLSearchParams();

  if (normalized.severity.length > 0) {
    params.set('severity', normalized.severity.join(','));
  }

  if (normalized.type.length > 0) {
    params.set('type', normalized.type.join(','));
  }

  if (normalized.status.length > 0) {
    params.set('status', normalized.status.join(','));
  }

  if (normalized.dateFrom) {
    params.set('dateFrom', normalized.dateFrom);
  }

  if (normalized.dateTo) {
    params.set('dateTo', normalized.dateTo);
  }

  if (normalized.minConfidence) {
    params.set('minConfidence', normalized.minConfidence);
  }

  if ((options?.page ?? 1) > 1) {
    params.set('page', String(options?.page));
  }

  return params;
}

export function hasFindingFilters(filters: FindingFiltersState) {
  return (
    filters.severity.length > 0
    || filters.type.length > 0
    || filters.status.length > 0
    || filters.dateFrom.length > 0
    || filters.dateTo.length > 0
    || filters.minConfidence.length > 0
  );
}

export function parseMinConfidenceNumber(value: string | null | undefined) {
  const normalized = normalizeMinConfidenceValue(value);
  return normalized ? Number.parseFloat(normalized) : null;
}
