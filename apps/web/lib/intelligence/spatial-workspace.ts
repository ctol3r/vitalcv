export const SPATIAL_WORKSPACE_VIEWS = [
  'dashboard',
  'findings',
  'storylines',
  'providers',
  'investigations',
  'graph',
] as const;

export const LEGACY_INTELLIGENCE_SURFACE_VIEWS = [
  'actions',
  'calibration',
  'system-health',
] as const;

export type SpatialWorkspaceView = (typeof SPATIAL_WORKSPACE_VIEWS)[number];
export type SpatialEntityType = 'provider' | 'finding' | 'storyline';

export interface WorkspaceViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkspacePage {
  key: string;
  type: SpatialEntityType;
  entityId: string;
  sourcePageKey: string | null;
  label?: string | null;
  subtitle?: string | null;
}

export interface SpatialWorkspaceFilters {
  q: string;
  provider: string;
  severity: string[];
  status: string[];
  type: string[];
  storylineType: string;
  perspective: string;
  minConfidence: string;
  minTrustScore: string;
  investigatorId: string;
  dateFrom: string;
  dateTo: string;
}

export interface SpatialWorkspaceRouteState {
  view: SpatialWorkspaceView;
  selectedNode: string | null;
  graphFocus: string | null;
  openPages: WorkspacePage[];
  viewport: WorkspaceViewport;
  filters: SpatialWorkspaceFilters;
}

export const DEFAULT_SPATIAL_WORKSPACE_VIEW: SpatialWorkspaceView = 'dashboard';
export const DEFAULT_WORKSPACE_VIEWPORT: WorkspaceViewport = {
  x: 48,
  y: 40,
  zoom: 1,
};

const PAGE_KEY_SEPARATOR = ':';
const PROVIDER_RE = /^\d{10}$/;
const FLOAT_RE = /^-?\d+(\.\d+)?$/;

function normalizeListValue(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )];
}

function parseOptionalFloat(value: string | null | undefined, fallback: number): number {
  if (!value || !FLOAT_RE.test(value)) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function appendIfPresent(params: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    params.set(key, trimmed);
  }
}

function appendList(params: URLSearchParams, key: string, values: readonly string[]) {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (normalized.length > 0) {
    params.set(key, normalized.join(','));
  }
}

export function isSpatialWorkspaceView(value: string | null | undefined): value is SpatialWorkspaceView {
  return Boolean(value) && SPATIAL_WORKSPACE_VIEWS.includes(value as SpatialWorkspaceView);
}

export function buildWorkspacePageKey(type: SpatialEntityType, entityId: string): string {
  return `${type}${PAGE_KEY_SEPARATOR}${entityId}`;
}

export function parseWorkspacePageKey(value: string | null | undefined): Pick<WorkspacePage, 'key' | 'type' | 'entityId'> | null {
  if (!value) {
    return null;
  }

  const separatorIndex = value.indexOf(PAGE_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return null;
  }

  const type = value.slice(0, separatorIndex);
  const entityId = value.slice(separatorIndex + 1);

  if (
    (type !== 'provider' && type !== 'finding' && type !== 'storyline')
    || entityId.trim().length === 0
  ) {
    return null;
  }

  return {
    key: value,
    type,
    entityId,
  };
}

export function createWorkspacePage(
  type: SpatialEntityType,
  entityId: string,
  options: Pick<WorkspacePage, 'sourcePageKey' | 'label' | 'subtitle'> = {
    sourcePageKey: null,
  },
): WorkspacePage {
  return {
    key: buildWorkspacePageKey(type, entityId),
    type,
    entityId,
    sourcePageKey: options.sourcePageKey ?? null,
    label: options.label ?? null,
    subtitle: options.subtitle ?? null,
  };
}

function parseOpenPages(values: readonly string[]): WorkspacePage[] {
  const pages: WorkspacePage[] = [];

  for (const value of values) {
    const parsed = parseWorkspacePageKey(value);
    if (!parsed || pages.some((page) => page.key === parsed.key)) {
      continue;
    }

    pages.push({
      ...parsed,
      sourcePageKey: null,
      label: null,
      subtitle: null,
    });
  }

  return pages;
}

function inferOpenPagesFromAnchors(
  searchParams: URLSearchParams,
  existingPages: readonly WorkspacePage[],
): WorkspacePage[] {
  if (existingPages.length > 0) {
    return [...existingPages];
  }

  const pages: WorkspacePage[] = [];
  const npi = searchParams.get('npi');
  const findingId = searchParams.get('findingId');
  const storylineId = searchParams.get('storylineId');

  if (npi && PROVIDER_RE.test(npi)) {
    pages.push(createWorkspacePage('provider', npi));
  }

  if (findingId) {
    pages.push(createWorkspacePage('finding', findingId));
  }

  if (storylineId) {
    pages.push(createWorkspacePage('storyline', storylineId));
  }

  return pages;
}

function inferSelectedNode(
  searchParams: URLSearchParams,
  openPages: readonly WorkspacePage[],
): string | null {
  const selected = parseWorkspacePageKey(searchParams.get('selected'));
  if (selected && openPages.some((page) => page.key === selected.key)) {
    return selected.key;
  }

  return openPages[openPages.length - 1]?.key ?? null;
}

function inferGraphFocus(
  searchParams: URLSearchParams,
  openPages: readonly WorkspacePage[],
  selectedNode: string | null,
): string | null {
  const focus = parseWorkspacePageKey(searchParams.get('focus'));
  if (focus && openPages.some((page) => page.key === focus.key)) {
    return focus.key;
  }

  return selectedNode;
}

export function parseSpatialWorkspaceRouteState(
  input: URLSearchParams,
  preferredView?: SpatialWorkspaceView,
): SpatialWorkspaceRouteState {
  const requestedView = input.get('view');
  const view: SpatialWorkspaceView = preferredView ?? (
    isSpatialWorkspaceView(requestedView)
      ? requestedView
      : DEFAULT_SPATIAL_WORKSPACE_VIEW
  );
  const explicitOpenPages = parseOpenPages(input.getAll('open'));
  const openPages = inferOpenPagesFromAnchors(input, explicitOpenPages);
  const selectedNode = inferSelectedNode(input, openPages);

  return {
    view,
    selectedNode,
    graphFocus: inferGraphFocus(input, openPages, selectedNode),
    openPages,
    viewport: {
      x: parseOptionalFloat(input.get('x'), DEFAULT_WORKSPACE_VIEWPORT.x),
      y: parseOptionalFloat(input.get('y'), DEFAULT_WORKSPACE_VIEWPORT.y),
      zoom: parseOptionalFloat(input.get('zoom'), DEFAULT_WORKSPACE_VIEWPORT.zoom),
    },
    filters: {
      q: input.get('q') ?? '',
      provider: input.get('provider') ?? '',
      severity: normalizeListValue(input.get('severity')),
      status: normalizeListValue(input.get('status')),
      type: normalizeListValue(input.get('type') ?? input.get('findingType')),
      storylineType: input.get('storylineType') ?? '',
      perspective: input.get('perspective') ?? '',
      minConfidence: input.get('minConfidence') ?? '',
      minTrustScore: input.get('minTrustScore') ?? '',
      investigatorId: input.get('investigatorId') ?? '',
      dateFrom: input.get('dateFrom') ?? '',
      dateTo: input.get('dateTo') ?? '',
    },
  };
}

export function buildSpatialWorkspaceSearchParams(
  state: SpatialWorkspaceRouteState,
): URLSearchParams {
  const params = new URLSearchParams();

  params.set('view', state.view);
  appendIfPresent(params, 'q', state.filters.q);
  appendIfPresent(params, 'provider', state.filters.provider);
  appendList(params, 'severity', state.filters.severity);
  appendList(params, 'status', state.filters.status);
  appendList(params, 'type', state.filters.type);
  appendIfPresent(params, 'storylineType', state.filters.storylineType);
  appendIfPresent(params, 'perspective', state.filters.perspective);
  appendIfPresent(params, 'minConfidence', state.filters.minConfidence);
  appendIfPresent(params, 'minTrustScore', state.filters.minTrustScore);
  appendIfPresent(params, 'investigatorId', state.filters.investigatorId);
  appendIfPresent(params, 'dateFrom', state.filters.dateFrom);
  appendIfPresent(params, 'dateTo', state.filters.dateTo);

  for (const page of state.openPages) {
    params.append('open', page.key);
  }

  if (state.selectedNode) {
    params.set('selected', state.selectedNode);
  }

  if (state.graphFocus && state.graphFocus !== state.selectedNode) {
    params.set('focus', state.graphFocus);
  }

  if (Math.abs(state.viewport.x - DEFAULT_WORKSPACE_VIEWPORT.x) > 0.1) {
    params.set('x', state.viewport.x.toFixed(2));
  }
  if (Math.abs(state.viewport.y - DEFAULT_WORKSPACE_VIEWPORT.y) > 0.1) {
    params.set('y', state.viewport.y.toFixed(2));
  }
  if (Math.abs(state.viewport.zoom - DEFAULT_WORKSPACE_VIEWPORT.zoom) > 0.001) {
    params.set('zoom', state.viewport.zoom.toFixed(3));
  }

  return params;
}

export function buildSpatialWorkspaceHref(
  state: SpatialWorkspaceRouteState,
): string {
  const params = buildSpatialWorkspaceSearchParams(state);
  return `/intelligence?${params.toString()}`;
}

export function buildSpatialWorkspaceHrefFromSearchParams(
  view: SpatialWorkspaceView,
  params: URLSearchParams,
): string {
  const state = parseSpatialWorkspaceRouteState(params, view);
  return buildSpatialWorkspaceHref({
    ...state,
    view,
  });
}
