/**
 * Professional Trust Cloud — platform telemetry (Wave 900, C6)
 * ──────────────────────────────────────────────────────────────────────────
 * Aggregate operational counters over platform events — counts only, no PII.
 * Telemetry records carry an event type, a tenant, and a timestamp; never a
 * subjectKey, name, or payload. Records that don't validate are dropped, so a
 * caller cannot smuggle identifying data into the metrics.
 */
import { PLATFORM_EVENT_TYPES, type PlatformEventType } from './events';

/** A single telemetry data point. Deliberately free of any provider identity. */
export interface TelemetryRecord {
  type: PlatformEventType;
  tenantId: string;
  /** ISO-8601 UTC, no sub-identity. */
  occurredAt: string;
}

export interface TelemetrySummary {
  total: number;
  byType: Record<string, number>;
  byTenant: Record<string, number>;
  /** Distinct tenants seen. */
  tenantCount: number;
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const ALLOWED_KEYS = new Set(['type', 'tenantId', 'occurredAt']);

/**
 * Strict validation — mirrors the solutions-analytics posture. A record must
 * have ONLY the three allowed keys, a known event type, a non-empty tenantId,
 * and a strict ISO-8601 timestamp. Anything else (extra keys = possible PII) is
 * rejected.
 */
export function isTelemetryRecord(value: unknown): value is TelemetryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== ALLOWED_KEYS.size || !keys.every((k) => ALLOWED_KEYS.has(k))) return false;
  const r = value as Record<string, unknown>;
  if (!(PLATFORM_EVENT_TYPES as readonly string[]).includes(r.type as string)) return false;
  if (typeof r.tenantId !== 'string' || r.tenantId.trim().length === 0 || r.tenantId.length > 64) return false;
  if (typeof r.occurredAt !== 'string' || !ISO_8601.test(r.occurredAt)) return false;
  return true;
}

/** Aggregate validated records into counters. Invalid records are dropped. */
export function aggregateTelemetry(records: unknown[]): TelemetrySummary {
  const byType: Record<string, number> = {};
  const byTenant: Record<string, number> = {};
  let total = 0;

  for (const rec of records) {
    if (!isTelemetryRecord(rec)) continue;
    total += 1;
    byType[rec.type] = (byType[rec.type] ?? 0) + 1;
    byTenant[rec.tenantId] = (byTenant[rec.tenantId] ?? 0) + 1;
  }

  return { total, byType, byTenant, tenantCount: Object.keys(byTenant).length };
}
