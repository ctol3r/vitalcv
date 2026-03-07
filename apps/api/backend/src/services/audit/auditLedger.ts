/**
 * auditLedger.ts — Substrate Consolidation: Phase 2
 *
 * Append-only audit ledger with structured fields, traceId propagation,
 * cursor-based export, and SIEM-friendly JSON streaming.
 *
 * Design principles:
 *   - Append-only: entries are never mutated or deleted
 *   - Receipt hash: SHA-256 over canonical entry payload
 *   - SIEM-friendly: structured JSON with category, severity, actor, resource
 *   - TraceId: propagated across issuance / presentation / decision / revocation / monitoring
 *   - Cursor-based export: efficient streaming for large audit volumes
 */

import { createHash, randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type AuditCategory =
  | 'ISSUANCE'
  | 'PRESENTATION'
  | 'VERIFICATION'
  | 'REVOCATION'
  | 'DECISION'
  | 'MONITORING'
  | 'FEDERATION'
  | 'COMPLIANCE'
  | 'AUTH'
  | 'ADMIN'
  | 'SYSTEM'
  | 'TRUST_STATE_CHANGE'
  | 'BUNDLE_EXPORT';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

export interface AuditEntry {
  /** Unique event ID (UUID v4) */
  eventId: string;
  /** ISO-8601 timestamp */
  time: string;
  /** Correlation ID propagated across a logical operation (e.g. issuance flow) */
  traceId: string;
  /** One or more functional categories */
  category: AuditCategory[];
  /** Principal performing the action (DID, NPI, userId, service name) */
  actor: string;
  /** The target resource (credentialId, npi, entityId, etc.) */
  resource: string;
  /** Sanitised inbound request fields (no secrets) */
  requestFields: Record<string, unknown>;
  /** Sanitised result fields */
  resultFields: Record<string, unknown>;
  /** Severity level */
  severity: AuditSeverity;
  /** SHA-256 of the canonical pre-hash payload — integrity anchor */
  receiptHash: string;
}

export interface AppendAuditOptions {
  eventId?: string;
  time?: string;
  traceId?: string;
  category: AuditCategory | AuditCategory[];
  actor: string;
  resource: string;
  requestFields?: Record<string, unknown>;
  resultFields?: Record<string, unknown>;
  severity?: AuditSeverity;
}

export interface AuditCursor {
  /** eventId after which to start (exclusive). Empty string = from beginning. */
  after: string;
  /** Maximum number of events to return */
  limit: number;
}

export interface AuditPage {
  events: AuditEntry[];
  nextCursor: string | null;  // null = no more events
  totalReturned: number;
}

// ── In-memory ledger ──────────────────────────────────────────────────

/** Ordered log — append only. */
const ledger: AuditEntry[] = [];

/** Index: eventId → position in ledger array */
const eventIndex = new Map<string, number>();

// ── Hash helper ───────────────────────────────────────────────────────

function hashPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Append an event to the audit ledger. Returns the immutable entry.
 * This is the ONLY write path — all other paths are read-only.
 */
export function appendAuditEvent(opts: AppendAuditOptions): AuditEntry {
  const eventId = opts.eventId ?? randomUUID();
  const time = opts.time ?? new Date().toISOString();
  const traceId = opts.traceId ?? randomUUID();
  const category = Array.isArray(opts.category) ? opts.category : [opts.category];
  const severity = opts.severity ?? 'INFO';
  const requestFields = opts.requestFields ?? {};
  const resultFields = opts.resultFields ?? {};

  // Canonical payload for hashing (excludes receiptHash itself)
  const preHashPayload = {
    eventId,
    time,
    traceId,
    category,
    actor: opts.actor,
    resource: opts.resource,
    requestFields,
    resultFields,
    severity,
  };

  const receiptHash = hashPayload(preHashPayload);

  const entry: AuditEntry = {
    ...preHashPayload,
    receiptHash,
  };

  // Append-only: freeze the entry to prevent mutation
  Object.freeze(entry);

  const position = ledger.length;
  ledger.push(entry);
  eventIndex.set(eventId, position);

  if (severity === 'CRITICAL' || severity === 'EMERGENCY') {
    log('warn', 'audit_ledger_critical_event', {
      eventId,
      traceId,
      category,
      actor: opts.actor,
      resource: opts.resource,
      severity,
    });
  }

  return entry;
}

/**
 * Cursor-based page export — suitable for streaming large audit volumes.
 * The cursor is the eventId of the last seen event (exclusive lower bound).
 */
export function exportAuditPage(cursor: AuditCursor): AuditPage {
  const { after, limit } = cursor;
  let startIdx = 0;

  if (after) {
    const pos = eventIndex.get(after);
    if (pos !== undefined) {
      startIdx = pos + 1;
    } else {
      // Unknown cursor — return empty page rather than fail
      return { events: [], nextCursor: null, totalReturned: 0 };
    }
  }

  const slice = ledger.slice(startIdx, startIdx + limit);
  const lastEvent = slice[slice.length - 1];
  const hasMore = startIdx + limit < ledger.length;

  return {
    events: slice,
    nextCursor: hasMore && lastEvent ? lastEvent.eventId : null,
    totalReturned: slice.length,
  };
}

/**
 * Return all events in the ledger since a given ISO-8601 time (inclusive).
 * Intended for SIEM export queries.
 */
export function exportSinceTime(since: string, maxEvents = 10_000): AuditEntry[] {
  const sinceMs = new Date(since).getTime();
  return ledger
    .filter((e) => new Date(e.time).getTime() >= sinceMs)
    .slice(0, maxEvents);
}

/**
 * Return total event count — useful for health checks.
 */
export function getLedgerSize(): number {
  return ledger.length;
}

/**
 * Return a single event by ID, or null if not found.
 */
export function getAuditEvent(eventId: string): AuditEntry | null {
  const pos = eventIndex.get(eventId);
  return pos !== undefined ? ledger[pos] ?? null : null;
}

// ── TraceId context helpers ───────────────────────────────────────────

/**
 * Create a new traceId to propagate across a logical operation.
 * Caller is responsible for passing this traceId to all downstream
 * appendAuditEvent() calls within the same flow.
 */
export function newTraceId(): string {
  return randomUUID();
}

// ── Convenience emitters ──────────────────────────────────────────────

export function auditIssuance(opts: {
  traceId: string;
  actor: string;
  credentialId: string;
  subject: string;
  issuer: string;
  success: boolean;
  errors?: string[];
}): AuditEntry {
  return appendAuditEvent({
    traceId: opts.traceId,
    category: 'ISSUANCE',
    actor: opts.actor,
    resource: opts.credentialId,
    severity: opts.success ? 'INFO' : 'WARNING',
    requestFields: { issuer: opts.issuer, subject: opts.subject },
    resultFields: { success: opts.success, errors: opts.errors ?? [] },
  });
}

export function auditPresentation(opts: {
  traceId: string;
  actor: string;
  presentationId: string;
  subject: string;
  verifier: string;
  disclosedClaims: string[];
  success: boolean;
  errors?: string[];
}): AuditEntry {
  return appendAuditEvent({
    traceId: opts.traceId,
    category: 'PRESENTATION',
    actor: opts.actor,
    resource: opts.presentationId,
    severity: opts.success ? 'INFO' : 'WARNING',
    requestFields: {
      subject: opts.subject,
      verifier: opts.verifier,
      disclosedClaims: opts.disclosedClaims,
    },
    resultFields: { success: opts.success, errors: opts.errors ?? [] },
  });
}

export function auditRevocation(opts: {
  traceId: string;
  actor: string;
  credentialId: string;
  issuer: string;
  reason: string;
}): AuditEntry {
  return appendAuditEvent({
    traceId: opts.traceId,
    category: 'REVOCATION',
    actor: opts.actor,
    resource: opts.credentialId,
    severity: 'CRITICAL',
    requestFields: { issuer: opts.issuer },
    resultFields: { reason: opts.reason },
  });
}

export function auditDecision(opts: {
  traceId: string;
  actor: string;
  capsuleId: string;
  subject: string;
  decision: string;
  rationale?: string;
}): AuditEntry {
  return appendAuditEvent({
    traceId: opts.traceId,
    category: 'DECISION',
    actor: opts.actor,
    resource: opts.capsuleId,
    severity: 'INFO',
    requestFields: { subject: opts.subject },
    resultFields: { decision: opts.decision, rationale: opts.rationale ?? '' },
  });
}

export function auditMonitoring(opts: {
  traceId: string;
  actor: string;
  resource: string;
  event: string;
  severity?: AuditSeverity;
  details?: Record<string, unknown>;
}): AuditEntry {
  return appendAuditEvent({
    traceId: opts.traceId,
    category: 'MONITORING',
    actor: opts.actor,
    resource: opts.resource,
    severity: opts.severity ?? 'INFO',
    requestFields: { event: opts.event },
    resultFields: opts.details ?? {},
  });
}
