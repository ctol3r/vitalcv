/**
 * longitudinalIntegrityReport.ts — W2-PR40A
 *
 * Builds a longitudinal (time-windowed) integrity report from a stream of
 * audit-event records. The report groups events into windows (daily, weekly,
 * or arbitrary-length buckets), counts integrity-relevant signals per
 * window, and emits a deterministic per-window hash chain so a regulator can
 * verify "the audit history between time T1 and T2 has not been retroactively
 * altered" by re-hashing.
 *
 * Pure transform — no prisma, no fetches, no audit writes.
 *
 * Design notes:
 *   - Each window's hash is computed over (sorted event ids + receipt
 *     hashes). This is independent of the event order in storage but
 *     deterministic given the same set.
 *   - Windows form a chain: window N's `chainHash` folds in window N-1's
 *     `chainHash` so retroactive insertion in window N-2 invalidates every
 *     hash from N-2 onwards.
 *   - Empty windows are preserved (zero events, but still a hash) so a
 *     gap in the timeline is visible to the regulator.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import {
  mapAuditEventToStandards,
  type RegulatoryStandardId,
} from './regulatoryTraceability';
import type { AuditEventType } from '../../../types/auditEventTypes';

const SCHEMA = 'vitalcv.longitudinal-integrity-report.v1' as const;

export type WindowGranularity = 'DAY' | 'WEEK' | 'MONTH';

export interface LongitudinalEventInput {
  eventId: string;
  auditEventType: AuditEventType;
  occurredAt: string;
  receiptHash: string;
  /** Optional source identifier — used for NCQA element refinement. */
  source?: string | null;
  /** Optional severity label propagated from auditLedger. */
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY' | null;
}

export interface LongitudinalWindow {
  windowStart: string;       // ISO-8601, inclusive
  windowEnd: string;         // ISO-8601, exclusive
  granularity: WindowGranularity;
  eventCount: number;
  /** Counts per standardId — surfaces which NCQA / URAC sections moved in
   *  this window. */
  standardActivity: Array<{ standardId: RegulatoryStandardId; count: number }>;
  /** Counts per severity. CRITICAL + EMERGENCY are first-class signals. */
  severityCounts: { INFO: number; WARNING: number; CRITICAL: number; EMERGENCY: number };
  /** Sorted event ids — deterministic. */
  eventIds: string[];
  /** SHA-256 over canonical (sorted ids + receipt hashes) for this window. */
  windowHash: string;
  /** Hash chain that folds in the previous window's chainHash. */
  chainHash: string;
}

export interface LongitudinalIntegrityReport {
  schema: typeof SCHEMA;
  reportId: string;
  generatedAt: string;
  subject: { clinicianNpi: string | null };
  range: { from: string; to: string };
  granularity: WindowGranularity;
  totals: {
    eventsConsidered: number;
    windowCount: number;
    nonEmptyWindowCount: number;
    /** Sum of CRITICAL + EMERGENCY events across all windows. */
    criticalOrEmergencyCount: number;
  };
  windows: LongitudinalWindow[];
  /** Final chain head — a regulator can re-derive the report and compare. */
  chainHead: string;
  reportHash: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function windowMs(granularity: WindowGranularity): number {
  switch (granularity) {
    case 'DAY':
      return DAY_MS;
    case 'WEEK':
      return WEEK_MS;
    case 'MONTH':
      return 30 * DAY_MS;
  }
}

function windowStartFor(occurredAtMs: number, fromMs: number, ms: number): number {
  // Round down to the nearest window boundary, anchored to `fromMs`.
  const offset = occurredAtMs - fromMs;
  const bucket = Math.floor(offset / ms);
  return fromMs + bucket * ms;
}

function severitySlot(): { INFO: number; WARNING: number; CRITICAL: number; EMERGENCY: number } {
  return { INFO: 0, WARNING: 0, CRITICAL: 0, EMERGENCY: 0 };
}

export interface BuildLongitudinalIntegrityReportInput {
  reportId: string;
  generatedAt: string;
  clinicianNpi?: string | null;
  events: LongitudinalEventInput[];
  range: { from: string; to: string };
  granularity: WindowGranularity;
}

export function buildLongitudinalIntegrityReport(
  input: BuildLongitudinalIntegrityReportInput,
): LongitudinalIntegrityReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    throw new Error('longitudinalIntegrityReport: range.from must precede range.to');
  }
  const ms = windowMs(input.granularity);

  // Bucket events by window-start.
  const buckets = new Map<number, LongitudinalEventInput[]>();
  let considered = 0;
  for (const e of input.events) {
    const occurredMs = Date.parse(e.occurredAt);
    if (!Number.isFinite(occurredMs)) continue;
    if (occurredMs < fromMs || occurredMs >= toMs) continue;
    considered += 1;
    const start = windowStartFor(occurredMs, fromMs, ms);
    const slot = buckets.get(start);
    if (slot) slot.push(e);
    else buckets.set(start, [e]);
  }

  // Walk the full range so empty windows are preserved.
  const windows: LongitudinalWindow[] = [];
  let prevChainHash = '';
  let nonEmpty = 0;
  let criticalOrEmergency = 0;

  for (let cursor = fromMs; cursor < toMs; cursor += ms) {
    const events = buckets.get(cursor) ?? [];
    if (events.length > 0) nonEmpty += 1;

    // Sort deterministically by eventId.
    const sortedEvents = [...events].sort((a, b) => a.eventId.localeCompare(b.eventId));
    const eventIds = sortedEvents.map((e) => e.eventId);

    // Severity tally
    const severityCounts = severitySlot();
    for (const e of sortedEvents) {
      const sev = e.severity ?? 'INFO';
      severityCounts[sev] += 1;
      if (sev === 'CRITICAL' || sev === 'EMERGENCY') criticalOrEmergency += 1;
    }

    // Standard activity — count per NCQA / URAC standard derived from event type
    const standardTally = new Map<RegulatoryStandardId, number>();
    for (const e of sortedEvents) {
      const trace = mapAuditEventToStandards({
        auditEventType: e.auditEventType,
        source: e.source ?? null,
      });
      for (const ref of trace.standards) {
        standardTally.set(ref.standardId, (standardTally.get(ref.standardId) ?? 0) + 1);
      }
    }
    const standardActivity = Array.from(standardTally.entries())
      .map(([standardId, count]) => ({ standardId, count }))
      .sort((a, b) =>
        b.count - a.count || a.standardId.localeCompare(b.standardId),
      );

    const windowHash = sha256ForPayload({
      windowStart: new Date(cursor).toISOString(),
      windowEnd: new Date(cursor + ms).toISOString(),
      eventIds,
      receiptHashes: sortedEvents.map((e) => e.receiptHash),
    });

    const chainHash = sha256ForPayload({ prev: prevChainHash, windowHash });
    prevChainHash = chainHash;

    windows.push({
      windowStart: new Date(cursor).toISOString(),
      windowEnd: new Date(cursor + ms).toISOString(),
      granularity: input.granularity,
      eventCount: events.length,
      standardActivity,
      severityCounts,
      eventIds,
      windowHash,
      chainHash,
    });
  }

  const body = {
    schema: SCHEMA,
    reportId: input.reportId,
    generatedAt: input.generatedAt,
    subject: { clinicianNpi: input.clinicianNpi ?? null },
    range: input.range,
    granularity: input.granularity,
    totals: {
      eventsConsidered: considered,
      windowCount: windows.length,
      nonEmptyWindowCount: nonEmpty,
      criticalOrEmergencyCount: criticalOrEmergency,
    },
    windows,
    chainHead: prevChainHash,
  };

  return {
    ...body,
    reportHash: sha256ForPayload(body),
  };
}

/**
 * Verify that a previously emitted report matches a fresh regeneration over
 * the same input set. Returns true when the chainHead and per-window hashes
 * match. This is the deterministic-reconstruction guarantee.
 */
export function verifyLongitudinalIntegrityReport(
  prior: LongitudinalIntegrityReport,
  rebuilt: LongitudinalIntegrityReport,
): { ok: boolean; chainHeadMatch: boolean; windowMismatchCount: number } {
  if (prior.windows.length !== rebuilt.windows.length) {
    return {
      ok: false,
      chainHeadMatch: prior.chainHead === rebuilt.chainHead,
      windowMismatchCount: Math.abs(prior.windows.length - rebuilt.windows.length),
    };
  }
  let mismatches = 0;
  for (let i = 0; i < prior.windows.length; i += 1) {
    if (prior.windows[i].windowHash !== rebuilt.windows[i].windowHash) mismatches += 1;
    if (prior.windows[i].chainHash !== rebuilt.windows[i].chainHash) mismatches += 1;
  }
  const chainHeadMatch = prior.chainHead === rebuilt.chainHead;
  return {
    ok: chainHeadMatch && mismatches === 0,
    chainHeadMatch,
    windowMismatchCount: mismatches,
  };
}

export const LONGITUDINAL_INTEGRITY_REPORT_SCHEMA = SCHEMA;
