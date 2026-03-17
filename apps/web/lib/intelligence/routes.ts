export const INTELLIGENCE_VIEWS = [
  'dashboard',
  'findings',
  'storylines',
  'providers',
  'actions',
  'investigations',
  'calibration',
  'system-health',
] as const;

export type IntelligenceView = (typeof INTELLIGENCE_VIEWS)[number];
export type IntelligenceNavKey = IntelligenceView | 'graph';

export const DEFAULT_INTELLIGENCE_VIEW: IntelligenceView = 'dashboard';

type ParamValue = string | number | boolean | null | undefined;
type ParamRecord = Record<string, ParamValue | readonly ParamValue[]>;

function appendParam(params: URLSearchParams, key: string, value: ParamValue | readonly ParamValue[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      appendParam(params, key, item);
    }
    return;
  }

  if (value === null || value === undefined) {
    return;
  }

  const serialized = String(value);
  if (serialized.length === 0) {
    return;
  }

  params.append(key, serialized);
}

function toSearchParams(input?: URLSearchParams | ParamRecord): URLSearchParams {
  if (!input) {
    return new URLSearchParams();
  }

  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    appendParam(params, key, value);
  }
  return params;
}

export function isIntelligenceView(value: string | null | undefined): value is IntelligenceView {
  return Boolean(value) && INTELLIGENCE_VIEWS.includes(value as IntelligenceView);
}

export function resolveIntelligenceView(value: string | null | undefined): IntelligenceView {
  return isIntelligenceView(value) ? value : DEFAULT_INTELLIGENCE_VIEW;
}

export function buildIntelligenceHref(
  view: IntelligenceView = DEFAULT_INTELLIGENCE_VIEW,
  input?: URLSearchParams | ParamRecord,
): string {
  const params = toSearchParams(input);
  params.set('view', view);
  return `/intelligence?${params.toString()}`;
}

export function buildLegacyRedirectHref(
  view: IntelligenceView,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'view' || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.length > 0) {
          params.append(key, item);
        }
      }
      continue;
    }

    if (value.length > 0) {
      params.set(key, value);
    }
  }

  return buildIntelligenceHref(view, params);
}

export function deriveIntelligenceNavKey(activeHref: string): IntelligenceNavKey {
  if (activeHref.startsWith('/graph')) {
    return 'graph';
  }

  if (activeHref.startsWith('/findings')) {
    return 'findings';
  }
  if (activeHref.startsWith('/storylines')) {
    return 'storylines';
  }
  if (activeHref.startsWith('/providers')) {
    return 'providers';
  }
  if (activeHref.startsWith('/actions')) {
    return 'actions';
  }
  if (activeHref.startsWith('/investigations')) {
    return 'investigations';
  }
  if (activeHref.startsWith('/calibration')) {
    return 'calibration';
  }
  if (activeHref.startsWith('/system-health')) {
    return 'system-health';
  }

  return 'dashboard';
}
