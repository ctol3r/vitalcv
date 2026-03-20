export const INTELLIGENCE_VIEWS = [
  'dashboard',
  'findings',
  'storylines',
  'providers',
  'actions',
  'graph',
  'investigations',
  'calibration',
  'system-health',
] as const;

export type IntelligenceView = (typeof INTELLIGENCE_VIEWS)[number];
export type IntelligenceNavKey = IntelligenceView;

export const DEFAULT_INTELLIGENCE_VIEW: IntelligenceView = 'dashboard';

type ParamValue = string | number | boolean | null | undefined;
type ParamRecord = Record<string, ParamValue | readonly ParamValue[]>;
type IntelligenceEntityFocus = 'provider' | 'finding' | 'storyline' | 'action';

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

  const serialized = String(value).trim();
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

function appendHash(href: string, hash: string): string {
  return hash.length > 0 ? `${href}${hash}` : href;
}

function normalizedPathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function singularEntityForPath(pathname: string): IntelligenceEntityFocus | null {
  if (/^\/providers\/[^/]+$/.test(pathname)) {
    return 'provider';
  }
  if (/^\/findings\/[^/]+$/.test(pathname)) {
    return 'finding';
  }
  if (/^\/storylines\/[^/]+$/.test(pathname)) {
    return 'storyline';
  }
  if (/^\/actions\/[^/]+$/.test(pathname)) {
    return 'action';
  }
  return null;
}

function viewForPath(pathname: string): IntelligenceView | null {
  if (pathname === '/findings') {
    return 'findings';
  }
  if (pathname === '/providers') {
    return 'providers';
  }
  if (pathname === '/storylines') {
    return 'storylines';
  }
  if (pathname === '/actions') {
    return 'actions';
  }
  if (pathname === '/investigations') {
    return 'investigations';
  }
  if (pathname === '/graph' || pathname === '/network' || pathname === '/intelligence/graph') {
    return 'graph';
  }
  if (pathname === '/system-health') {
    return 'system-health';
  }
  if (pathname === '/calibration') {
    return 'calibration';
  }
  return null;
}

function navKeyForValue(value: string | null | undefined): IntelligenceNavKey {
  switch (value) {
    case 'provider':
      return 'providers';
    case 'finding':
      return 'findings';
    case 'storyline':
      return 'storylines';
    case 'action':
      return 'actions';
    case 'findings':
    case 'providers':
    case 'storylines':
    case 'actions':
    case 'graph':
    case 'investigations':
    case 'calibration':
    case 'system-health':
      return value;
    default:
      return 'dashboard';
  }
}

function deleteAll(params: URLSearchParams, key: string) {
  params.delete(key);
}

function appendOpenPanels(params: URLSearchParams, panels: string[]) {
  if (panels.length === 0) {
    return;
  }

  params.delete('open');
  for (const panel of panels) {
    params.append('open', panel);
  }
}

function canonicalizeAliases(
  params: URLSearchParams,
  view: IntelligenceView,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const providerScope = next.get('provider') ?? next.get('providerId');
  const selectedNpi = next.get('npi') ?? providerScope;

  deleteAll(next, 'tab');
  deleteAll(next, 'focus');

  if (view === 'findings' || view === 'storylines') {
    if (providerScope && !next.get('provider')) {
      next.set('provider', providerScope);
    }
  }

  if (view === 'dashboard' || view === 'graph' || view === 'investigations') {
    if (selectedNpi && !next.get('npi')) {
      next.set('npi', selectedNpi);
    }
  }

  if (next.get('open') === 'none' && next.getAll('open').length === 1) {
    next.delete('open');
  }

  next.set('view', view);
  return next;
}

function buildHrefFromParams(view: IntelligenceView, params: URLSearchParams): string {
  const canonical = canonicalizeAliases(params, view);
  const query = canonical.toString();
  return `/intelligence${query ? `?${query}` : ''}`;
}

function canonicalizeLegacyFocus(params: URLSearchParams): { view: IntelligenceView; params: URLSearchParams } {
  const focus = params.get('focus');
  const id = params.get('id');
  const next = new URLSearchParams(params);

  deleteAll(next, 'focus');
  deleteAll(next, 'id');

  if (!focus) {
    return {
      view: resolveIntelligenceView(params.get('view') ?? params.get('tab')),
      params: next,
    };
  }

  switch (focus) {
    case 'provider':
      if (id && !next.get('npi')) {
        next.set('npi', id);
      }
      appendOpenPanels(next, ['provider']);
      return { view: 'dashboard', params: next };
    case 'finding':
      if (id && !next.get('findingId')) {
        next.set('findingId', id);
      }
      appendOpenPanels(next, ['finding']);
      return { view: 'dashboard', params: next };
    case 'storyline':
      if (id && !next.get('storylineId')) {
        next.set('storylineId', id);
      }
      appendOpenPanels(next, ['storyline']);
      return { view: 'dashboard', params: next };
    case 'action':
      if (id && !next.get('actionId')) {
        next.set('actionId', id);
      }
      return { view: 'actions', params: next };
    case 'graph':
      return { view: 'graph', params: next };
    default:
      return {
        view: resolveIntelligenceView(focus),
        params: next,
      };
  }
}

function canonicalizeDetailPath(
  entity: IntelligenceEntityFocus,
  id: string,
  params: URLSearchParams,
): string {
  const next = new URLSearchParams(params);
  next.delete('from');

  switch (entity) {
    case 'provider':
      if (!next.get('npi')) {
        next.set('npi', id);
      }
      appendOpenPanels(next, ['provider']);
      return buildHrefFromParams('dashboard', next);
    case 'finding':
      if (!next.get('findingId')) {
        next.set('findingId', id);
      }
      appendOpenPanels(next, ['finding']);
      return buildHrefFromParams('dashboard', next);
    case 'storyline':
      if (!next.get('storylineId')) {
        next.set('storylineId', id);
      }
      appendOpenPanels(next, ['storyline']);
      return buildHrefFromParams('dashboard', next);
    case 'action':
      if (!next.get('actionId')) {
        next.set('actionId', id);
      }
      return buildHrefFromParams('actions', next);
    default:
      return buildHrefFromParams(DEFAULT_INTELLIGENCE_VIEW, next);
  }
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
  return buildHrefFromParams(view, toSearchParams(input));
}

export function buildIntelligenceGraphHref(
  input?: URLSearchParams | ParamRecord,
): string {
  return buildIntelligenceHref('graph', input);
}

export function buildLegacyRedirectHref(
  view: IntelligenceView,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return buildIntelligenceHref(view, searchParams);
}

export function normalizeIntelligenceHref(href: string): string {
  if (
    href.length === 0
    || href.startsWith('#')
    || /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return href;
  }

  const url = new URL(href, 'https://vitalcv.local');
  const pathname = normalizedPathname(url.pathname);
  const singularEntity = singularEntityForPath(pathname);

  if (singularEntity) {
    const id = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
    return appendHash(canonicalizeDetailPath(singularEntity, id, url.searchParams), url.hash);
  }

  const mappedView = viewForPath(pathname);
  if (mappedView) {
    return appendHash(buildHrefFromParams(mappedView, url.searchParams), url.hash);
  }

  if (pathname === '/intelligence') {
    const { view, params } = canonicalizeLegacyFocus(url.searchParams);
    return appendHash(buildHrefFromParams(view, params), url.hash);
  }

  return href;
}

export function deriveIntelligenceNavKey(activeHref: string): IntelligenceNavKey {
  const activeUrl = new URL(activeHref, 'https://vitalcv.local');
  const requestedView = activeUrl.searchParams.get('view');
  const requestedFocus = activeUrl.searchParams.get('focus');

  if (isIntelligenceView(requestedView)) {
    return requestedView;
  }

  if (requestedFocus) {
    return navKeyForValue(requestedFocus);
  }

  if (activeHref.startsWith('/intelligence/graph') || activeHref.startsWith('/graph')) {
    return 'graph';
  }

  return navKeyForValue(viewForPath(normalizedPathname(activeUrl.pathname)));
}
