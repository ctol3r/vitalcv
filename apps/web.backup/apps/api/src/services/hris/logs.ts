import { createHash, randomUUID } from 'node:crypto';
import { anchorHrisSyncLog } from '../audit/anchor';
import type { HrisSyncLogEntry, HrisSyncLogInput } from './types';

const MAX_LOGS = 400;
const buffer: HrisSyncLogEntry[] = [];

export interface HrisAuditSummary {
  total: number;
  failures: number;
  lastAnchor?: string | null;
  vendors: Array<{ vendor: string; failures: number; lastFailure?: string }>;
}

export function recordHrisSyncLog(input: HrisSyncLogInput): HrisSyncLogEntry {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const completedAt = input.completedAt ?? new Date().toISOString();
  const entry: HrisSyncLogEntry = {
    id: randomUUID(),
    orgId: input.orgId,
    vendor: input.vendor,
    action: input.action,
    status: input.status,
    startedAt,
    completedAt,
    attempts: input.attempts,
    region: input.region ?? null,
    message: input.message ?? null,
    error: input.error ?? null,
    metadata: input.metadata ?? null,
    connectionId: input.connectionId ?? null,
  };

  buffer.unshift(entry);
  if (buffer.length > MAX_LOGS) {
    buffer.pop();
  }

  const logHash = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  anchorHrisSyncLog({
    orgId: entry.orgId,
    vendor: entry.vendor,
    action: entry.action,
    status: entry.status,
    region: entry.region ?? undefined,
    attempts: entry.attempts,
    logHash,
    connectionId: entry.connectionId ?? undefined,
    metadata: entry.metadata ?? undefined,
  }).catch((error) => console.warn('[hris][anchor] failed', error));

  return entry;
}

export function listHrisSyncLogs(filter: {
  orgId?: string;
  vendor?: string;
  status?: HrisSyncLogEntry['status'];
  limit?: number;
} = {}): HrisSyncLogEntry[] {
  const results = buffer.filter((entry) => {
    if (filter.orgId && entry.orgId !== filter.orgId) {
      return false;
    }
    if (filter.vendor && entry.vendor !== filter.vendor) {
      return false;
    }
    if (filter.status && entry.status !== filter.status) {
      return false;
    }
    return true;
  });

  if (filter.limit && filter.limit > 0) {
    return results.slice(0, filter.limit);
  }
  return results;
}

export function buildHrisAuditSummary(logs: HrisSyncLogEntry[], windowHours = 24): HrisAuditSummary {
  if (logs.length === 0) {
    return { total: 0, failures: 0, lastAnchor: null, vendors: [] };
  }

  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const failures = logs.filter((entry) => entry.status !== 'success');
  const vendors = new Map<string, { vendor: string; failures: number; lastFailure?: string }>();

  failures.forEach((entry) => {
    const bucket = vendors.get(entry.vendor) ?? { vendor: entry.vendor, failures: 0 };
    bucket.failures += 1;
    if (!bucket.lastFailure || bucket.lastFailure < entry.completedAt) {
      bucket.lastFailure = entry.completedAt;
    }
    vendors.set(entry.vendor, bucket);
  });

  const windowFailures = logs.filter(
    (entry) => new Date(entry.completedAt).getTime() >= cutoff && entry.status !== 'success',
  ).length;

  return {
    total: logs.length,
    failures: windowFailures,
    lastAnchor: logs[0]?.completedAt ?? null,
    vendors: Array.from(vendors.values()).sort((a, b) => b.failures - a.failures),
  };
}


