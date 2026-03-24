import type { PilotFilter } from './pilotKpiTypes';

type FilterFieldConfig = {
  filterKey: keyof PilotFilter;
  pageKey: string;
  backendKey: string;
  aliases: readonly string[];
};

const FILTER_FIELDS: readonly FilterFieldConfig[] = [
  {
    filterKey: 'orgContextId',
    pageKey: 'org',
    backendKey: 'orgContextId',
    aliases: ['org', 'orgContextId', 'organizationContextId'],
  },
  {
    filterKey: 'pilotId',
    pageKey: 'pilotId',
    backendKey: 'pilotId',
    aliases: ['pilot', 'pilotId'],
  },
  {
    filterKey: 'workflowLane',
    pageKey: 'lane',
    backendKey: 'workflowLane',
    aliases: ['lane', 'workflowLane'],
  },
  {
    filterKey: 'geographyTag',
    pageKey: 'geo',
    backendKey: 'geographyTag',
    aliases: ['geo', 'geographyTag'],
  },
] as const;

function readOptionalString(value: string | undefined | null): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function normalizePilotFilter(filter: PilotFilter): PilotFilter {
  return {
    orgContextId: readOptionalString(filter.orgContextId),
    pilotId: readOptionalString(filter.pilotId),
    workflowLane: readOptionalString(filter.workflowLane),
    geographyTag: readOptionalString(filter.geographyTag),
  };
}

export function readPilotFilterFromPageSearchParams(input: {
  org?: string;
  pilotId?: string;
  lane?: string;
  geo?: string;
}): PilotFilter {
  return normalizePilotFilter({
    orgContextId: input.org,
    pilotId: input.pilotId,
    workflowLane: input.lane,
    geographyTag: input.geo,
  });
}

export function appendPilotFilterParams(
  params: URLSearchParams,
  filter: PilotFilter,
  target: 'page' | 'backend',
): void {
  const normalized = normalizePilotFilter(filter);

  for (const field of FILTER_FIELDS) {
    const value = normalized[field.filterKey];
    if (!value) continue;
    params.set(target === 'page' ? field.pageKey : field.backendKey, value);
  }
}

export function appendPilotFilterFromSource(
  source: URLSearchParams,
  target: URLSearchParams,
  targetKind: 'page' | 'backend',
): void {
  const filter: PilotFilter = {};

  for (const field of FILTER_FIELDS) {
    const value = field.aliases
      .map((key) => readOptionalString(source.get(key)))
      .find((candidate): candidate is string => candidate !== null);

    if (value) {
      filter[field.filterKey] = value;
    }
  }

  appendPilotFilterParams(target, filter, targetKind);
}

export function buildPilotOpsHref(days: number, filter: PilotFilter): string {
  const params = new URLSearchParams();
  params.set('days', String(days));
  appendPilotFilterParams(params, filter, 'page');
  return `/pilot-ops?${params.toString()}`;
}

export function buildPilotExportHref(path: string, days: number, filter: PilotFilter): string {
  const params = new URLSearchParams();
  params.set('days', String(days));
  appendPilotFilterParams(params, filter, 'page');
  return `${path}?${params.toString()}`;
}

export function buildBackendPilotKpiParams(days: number, filter: PilotFilter): URLSearchParams {
  const params = new URLSearchParams();
  params.set('days', String(days));
  appendPilotFilterParams(params, filter, 'backend');
  return params;
}
