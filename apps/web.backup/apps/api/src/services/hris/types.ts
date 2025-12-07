import type { PrismaClient } from '@prisma/client';

export type HrisVendor = 'workday' | 'ukg' | 'adp' | 'oracle';

export interface HrisConnectionRecord {
  id: string;
  orgId: string;
  type: string;
  endpoint: string;
  secret: string;
}

export interface RegionEndpoint {
  region: string;
  endpoint: string;
}

export interface HrisConnectorOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  prisma?: PrismaClient;
  regionEndpoints?: RegionEndpoint[];
}

export interface HrisConnectorTestStep {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  durationMs: number;
}

export interface HrisConnectorTestResult {
  connectionId: string;
  orgId: string;
  vendor: string;
  status: 'pass' | 'fail' | 'warn';
  latencyMs: number;
  startedAt: string;
  completedAt: string;
  region?: string;
  message?: string;
  steps: HrisConnectorTestStep[];
}

export interface HrisSyncLogEntry {
  id: string;
  orgId: string;
  vendor: string;
  action: string;
  status: 'success' | 'failed' | 'partial';
  startedAt: string;
  completedAt: string;
  attempts: number;
  region?: string | null;
  message?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  connectionId?: string | null;
}

export interface HrisSyncLogInput
  extends Omit<HrisSyncLogEntry, 'id' | 'startedAt' | 'completedAt' | 'metadata'> {
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

export function normalizeVendorType(type: string): HrisVendor {
  const normalized = type?.toString().toLowerCase() ?? '';
  switch (normalized) {
    case 'workday':
      return 'workday';
    case 'ukg':
      return 'ukg';
    case 'adp':
      return 'adp';
    case 'oracle':
      return 'oracle';
    default:
      return 'workday';
  }
}

export function resolveRegionEndpoints(
  endpoint: string,
  overrides?: RegionEndpoint[],
): RegionEndpoint[] {
  if (overrides?.length) {
    return dedupeRegions(overrides);
  }
  const trimmed = endpoint?.trim() ?? '';
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Array<Partial<RegionEndpoint>>;
      return dedupeRegions(
        parsed
          .map((item, index) => ({
            region: item.region ?? `region-${index + 1}`,
            endpoint: normalizeEndpoint(item.endpoint ?? ''),
          }))
          .filter((item) => Boolean(item.endpoint)),
      );
    } catch {
      return [{ region: 'primary', endpoint: normalizeEndpoint(trimmed) }];
    }
  }

  if (trimmed.includes(',')) {
    const split = trimmed
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return dedupeRegions(
      split.map((value, index) => ({
        region: `region-${index + 1}`,
        endpoint: normalizeEndpoint(value),
      })),
    );
  }

  return [{ region: 'primary', endpoint: normalizeEndpoint(trimmed) }];
}

function dedupeRegions(regions: RegionEndpoint[]): RegionEndpoint[] {
  const seen = new Set<string>();
  const result: RegionEndpoint[] = [];
  regions.forEach((item) => {
    const key = `${item.region}:${item.endpoint}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push({
      region: item.region || `region-${result.length + 1}`,
      endpoint: normalizeEndpoint(item.endpoint),
    });
  });
  return result;
}

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint) {
    return '';
  }
  const normalized = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}


