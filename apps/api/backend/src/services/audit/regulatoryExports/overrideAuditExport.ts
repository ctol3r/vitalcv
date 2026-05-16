/**
 * overrideAuditExport.ts — W2-PR40A
 *
 * Builds a regulator-readable export of override-class audit events
 * (employer-review accepts, refresh requests, routing-to-review, denied
 * mutations, packet shares). Each entry is bound to its NCQA / URAC
 * traceability and carries actor attribution + the runtime mutation
 * fingerprint for replay.
 *
 * The override export is the audit-of-record answer to the regulator
 * question: "who pressed which button on this dossier, and why?"
 *
 * Pure transform — no prisma, no fetches, no audit writes.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import {
  mapAuditEventToStandards,
  type RegulatoryStandardReference,
} from './regulatoryTraceability';
import type { AuditEventType } from '../../../types/auditEventTypes';
import type {
  RuntimeReplayCategory,
  RuntimeMutationClassification,
} from '../../runtimeTrustCohesion';

const SCHEMA = 'vitalcv.override-audit-export.v1' as const;

export type OverrideOutcome = 'allowed' | 'denied' | 'replayed';

export interface OverrideAuditEntry {
  auditEventId: string;
  auditEventType: AuditEventType;
  occurredAt: string;
  /** Actor performing the override (employer user id, system, etc.). */
  actorId: string;
  actorType: 'human' | 'system' | 'unknown';
  attributionSource: 'x-clerk-user-id' | 'system' | 'unknown';
  /** Subject of the override action. */
  entityId: string;
  clinicianNpi: string;
  /** Operator-supplied reason (if any) — sanitized at the call site already. */
  reason: string | null;
  /** Outcome from runtimeTrustCohesion. */
  outcome: OverrideOutcome;
  /** Runtime classification labels — let regulators correlate via R-CAT. */
  mutationClassification: RuntimeMutationClassification;
  replayCategory: RuntimeReplayCategory;
  mutationFingerprint: string;
  payloadHash: string;
  correlationId: string;
  /** Was this override attempted by a read-only token? */
  attemptedByReadonly: boolean;
  /** NCQA / URAC sections this override supports. */
  standards: RegulatoryStandardReference[];
  /** Plain-English regulator rationale. */
  rationale: string;
}

export interface OverrideAuditSummary {
  totalOverrides: number;
  allowedCount: number;
  deniedCount: number;
  refreshRequestCount: number;
  routedToReviewCount: number;
  acceptedCount: number;
  packetSharedCount: number;
  /** Counts of overrides per actor — surfaces concentration / single-operator patterns. */
  actorBreakdown: Array<{ actorId: string; count: number }>;
  /** Read-only token attempts surface as their own metric — they MUST be zero
   *  in a healthy environment. Non-zero means a bypass was attempted. */
  readonlyAttempts: number;
}

export interface OverrideAuditExport {
  schema: typeof SCHEMA;
  exportId: string;
  generatedAt: string;
  subject: { entityId: string | null; clinicianNpi: string | null };
  /** Time range covered by this export — null when the source data is
   *  incomplete on either side. */
  range: { from: string | null; to: string | null };
  summary: OverrideAuditSummary;
  entries: OverrideAuditEntry[];
  exportHash: string;
}

export interface OverrideAuditInputEntry {
  auditEventId: string;
  auditEventType: AuditEventType;
  occurredAt: string;
  actorId: string;
  actorType: 'human' | 'system' | 'unknown';
  attributionSource: 'x-clerk-user-id' | 'system' | 'unknown';
  entityId: string;
  clinicianNpi: string;
  reason: string | null;
  outcome: OverrideOutcome;
  mutationClassification: RuntimeMutationClassification;
  replayCategory: RuntimeReplayCategory;
  mutationFingerprint: string;
  payloadHash: string;
  correlationId: string;
  attemptedByReadonly: boolean;
}

export interface BuildOverrideAuditExportInput {
  exportId: string;
  generatedAt: string;
  filter?: { entityId?: string | null; clinicianNpi?: string | null };
  entries: OverrideAuditInputEntry[];
}

function rationaleFor(entry: OverrideAuditInputEntry): {
  standards: RegulatoryStandardReference[];
  rationale: string;
} {
  const trace = mapAuditEventToStandards({
    auditEventType: entry.auditEventType,
    replayCategory: entry.replayCategory,
    mutationClassification: entry.mutationClassification,
  });
  if (entry.outcome === 'denied') {
    return {
      standards: trace.standards,
      rationale: `Operator override was denied. Preserved as evidence under ${trace.standards[0]?.section ?? 'audit retention'} so a regulator can audit the attempt.`,
    };
  }
  if (entry.attemptedByReadonly) {
    return {
      standards: trace.standards,
      rationale:
        'Override attempted via a read-only credential. Recorded with full attribution; the system must reject these and surface the attempt.',
    };
  }
  return {
    standards: trace.standards,
    rationale: trace.rationale,
  };
}

function summarize(entries: OverrideAuditEntry[]): OverrideAuditSummary {
  const actorTally = new Map<string, number>();
  let allowed = 0;
  let denied = 0;
  let refresh = 0;
  let routed = 0;
  let accepted = 0;
  let packetShared = 0;
  let readonlyAttempts = 0;

  for (const e of entries) {
    actorTally.set(e.actorId, (actorTally.get(e.actorId) ?? 0) + 1);
    if (e.outcome === 'denied') denied += 1;
    else if (e.outcome === 'allowed') allowed += 1;

    if (e.attemptedByReadonly) readonlyAttempts += 1;

    switch (e.auditEventType) {
      case 'EMPLOYER_REVIEW_ACCEPTED':
        accepted += 1;
        break;
      case 'EMPLOYER_REVIEW_REFRESH_REQUESTED':
        refresh += 1;
        break;
      case 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW':
        routed += 1;
        break;
      case 'EMPLOYER_PACKET_SHARED':
        packetShared += 1;
        break;
      default:
        break;
    }
  }

  return {
    totalOverrides: entries.length,
    allowedCount: allowed,
    deniedCount: denied,
    refreshRequestCount: refresh,
    routedToReviewCount: routed,
    acceptedCount: accepted,
    packetSharedCount: packetShared,
    actorBreakdown: Array.from(actorTally.entries())
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count || a.actorId.localeCompare(b.actorId)),
    readonlyAttempts,
  };
}

function computeRange(entries: OverrideAuditEntry[]): { from: string | null; to: string | null } {
  if (entries.length === 0) return { from: null, to: null };
  let min = entries[0].occurredAt;
  let max = entries[0].occurredAt;
  for (const e of entries) {
    if (e.occurredAt < min) min = e.occurredAt;
    if (e.occurredAt > max) max = e.occurredAt;
  }
  return { from: min, to: max };
}

export function buildOverrideAuditExport(
  input: BuildOverrideAuditExportInput,
): OverrideAuditExport {
  const filtered = input.entries.filter((e) => {
    if (input.filter?.entityId && e.entityId !== input.filter.entityId) return false;
    if (input.filter?.clinicianNpi && e.clinicianNpi !== input.filter.clinicianNpi) return false;
    return true;
  });

  const entries: OverrideAuditEntry[] = filtered.map((e) => {
    const { standards, rationale } = rationaleFor(e);
    return {
      auditEventId: e.auditEventId,
      auditEventType: e.auditEventType,
      occurredAt: e.occurredAt,
      actorId: e.actorId,
      actorType: e.actorType,
      attributionSource: e.attributionSource,
      entityId: e.entityId,
      clinicianNpi: e.clinicianNpi,
      reason: e.reason,
      outcome: e.outcome,
      mutationClassification: e.mutationClassification,
      replayCategory: e.replayCategory,
      mutationFingerprint: e.mutationFingerprint,
      payloadHash: e.payloadHash,
      correlationId: e.correlationId,
      attemptedByReadonly: e.attemptedByReadonly,
      standards,
      rationale,
    };
  });

  // Deterministic ordering: occurredAt ascending, then auditEventId.
  entries.sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt.localeCompare(b.occurredAt);
    return a.auditEventId.localeCompare(b.auditEventId);
  });

  const body = {
    schema: SCHEMA,
    exportId: input.exportId,
    generatedAt: input.generatedAt,
    subject: {
      entityId: input.filter?.entityId ?? null,
      clinicianNpi: input.filter?.clinicianNpi ?? null,
    },
    range: computeRange(entries),
    summary: summarize(entries),
    entries,
  };

  return {
    ...body,
    exportHash: sha256ForPayload(body),
  };
}

export const OVERRIDE_AUDIT_EXPORT_SCHEMA = SCHEMA;
