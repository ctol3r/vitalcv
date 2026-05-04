import type {
  IssuerRequestLifecycleActor,
  IssuerRequestEventSource,
  IssuerRequestLifecycleEvent,
  IssuerRequestTimeline,
} from './requestLifecycle';

/**
 * ISSUER-7 — Issuer audit persistence boundary.
 *
 * Truth contract:
 *   - A persistence STATUS (`persisted`) must never be claimed without
 *     a real writer's confirmation. The default is
 *     `pending_not_written`.
 *   - A demo writer or no-op writer can never return `persisted` —
 *     they return `demo_not_persisted` or `pending_not_written`.
 *   - `replaySafe` means an event MAY be included in a timeline
 *     replay for context; it does NOT mean the event is legal proof
 *     and does NOT change any claim's truth tier.
 *   - An audit event record describes ACTION HISTORY (who did what,
 *     when), NOT clinical truth. The credential claim's truth tier
 *     is governed by ISSUER-2/3/4/5 — the audit boundary cannot
 *     upgrade it.
 *   - This module is a pure transform — no database, no network, no
 *     external API calls, no outbound notification or callback
 *     dispatch. The no-op writer is the reference implementation;
 *     a real repository-backed writer is a future wave.
 */

/** The lifecycle action types this module knows how to record. */
export type IssuerAuditEventType =
  | 'consent_recorded'
  | 'manual_link_generated'
  | 'link_copied'
  | 'requester_marked_sent'
  | 'issuer_viewed'
  | 'response_received'
  | 'receipt_candidate_created'
  | 'policy_review_decided'
  | 'psv_receipt_promoted'
  | 'reuse_decision_built'
  | 'receipt_revoked'
  | 'receipt_superseded';

/**
 * Persistence status of a single audit event.
 *
 * - `pending_not_written`: default; nothing has been attempted.
 * - `demo_not_persisted`: a demo/no-op writer was used; no row was
 *   written. UI must display this distinctly from persisted.
 * - `simulated`: a writer ran and returned a synthesized result that
 *   would have been persisted in production but was not (e.g.,
 *   dry-run / preview).
 * - `persisted`: a real writer wrote a real row. Only producible by a
 *   writer whose `mode === 'repository'` (or `'external'`) AND whose
 *   `persisted` flag is true.
 * - `failed`: a real writer attempted to persist and failed. Caller
 *   should retry or surface to the operator.
 * - `unavailable`: no writer is wired in this environment.
 */
export type IssuerAuditWriteStatus =
  | 'pending_not_written'
  | 'demo_not_persisted'
  | 'simulated'
  | 'persisted'
  | 'failed'
  | 'unavailable';

/** What kind of writer is wired. Caller-controlled. */
export type IssuerAuditPersistenceMode =
  | 'none'
  | 'demo'
  | 'noop'
  | 'repository'
  | 'external';

/**
 * Correlation grouping for events that belong to the same request /
 * decision. `correlationId` is what threads events into a replay.
 */
export interface IssuerAuditCorrelation {
  correlationId: string;
  requestId: string;
  /** Optional subject (e.g., npi) — supplied when known. */
  subjectId?: string;
}

/**
 * The structural record VitalCV will eventually persist. This shape
 * does NOT depend on any database driver and intentionally mirrors
 * what a future `apps/api/backend/repositories/issuerAudit.repo.ts`
 * would write.
 */
export interface IssuerAuditEventRecord {
  eventId: string;
  correlationId: string;
  requestId: string;
  subjectId?: string;
  actor: IssuerRequestLifecycleActor;
  /** Mirror of actor.role for easier filtering downstream. */
  actorRole: IssuerRequestLifecycleActor['role'];
  eventType: IssuerAuditEventType;
  occurredAt: string;
  source: IssuerRequestEventSource;
  /** Persistence status at the moment this record was constructed. */
  persistenceStatus: IssuerAuditWriteStatus;
  /** Persistence mode the record was emitted under. */
  persistenceMode: IssuerAuditPersistenceMode;
  /**
   * Hash of the event payload — placeholder unless a writer with
   * cryptographic anchoring is wired (future wave). Empty string is
   * a valid placeholder; do NOT fabricate a hash.
   */
  payloadHash: string;
  limitationNote?: string;
  /** Pointer to the artifact the event is about (receipt id, etc.). */
  relatedArtifactId?: string;
  /**
   * True iff this record is safe to include in a timeline replay.
   * Demo/pending records can still be replay-safe — replay is
   * context, not proof.
   */
  replaySafe: boolean;
}

/**
 * Caller-supplied input for `buildIssuerAuditEventRecord`.
 */
export interface IssuerAuditWriteInput {
  eventId: string;
  correlation: IssuerAuditCorrelation;
  actor: IssuerRequestLifecycleActor;
  eventType: IssuerAuditEventType;
  occurredAt: string;
  source: IssuerRequestEventSource;
  /**
   * Optional payload hash. When omitted, the record carries an empty
   * string placeholder — never a fabricated hash.
   */
  payloadHash?: string;
  limitationNote?: string;
  relatedArtifactId?: string;
  /** Defaults to true. Set false for demo entries that should not replay. */
  replaySafe?: boolean;
}

/**
 * The result a writer returns. `persisted` is the only state that
 * promotes the record's status to `'persisted'`. Anything else
 * keeps the record at the demo/pending/failed status the caller
 * supplied.
 */
export interface IssuerAuditWriteResult {
  status: IssuerAuditWriteStatus;
  mode: IssuerAuditPersistenceMode;
  /** True iff a real audit-event row was written. */
  persisted: boolean;
  /** Free-text explanation; surfaced verbatim by review surfaces. */
  message: string;
  /** Optional id assigned by the persistence layer. */
  persistedId?: string;
  /** Optional error info when status === 'failed'. */
  error?: { code: string; message: string };
  /**
   * ISSUER-8 — Optional adapter decision metadata. When a writer
   * was selected via the persistence-adapter boundary
   * (auditPersistenceAdapter.ts), the decision payload is surfaced
   * here so callers can show the operator which adapter ran. Setting
   * this field does NOT change the persistence guarantee — the
   * `persisted` flag remains the load-bearing signal.
   */
  adapterDecision?: {
    kind:
      | 'noop'
      | 'demo'
      | 'repository_candidate'
      | 'repository_enabled'
      | 'unavailable';
    reason: string;
    wiringDescription?: string;
  };
}

/**
 * The replay surface for a request: a sequence of audit event
 * records plus an explicit boundary statement about what replay
 * means.
 */
export interface IssuerLifecycleReplay {
  requestId: string;
  correlationId: string;
  events: ReadonlyArray<IssuerAuditEventRecord>;
  /** Plain-language disclaimer surfaced verbatim by the page. */
  disclaimer: string;
  /** True iff EVERY event in the replay is replaySafe. */
  fullyReplaySafe: boolean;
}

/**
 * Map a lifecycle event status to the audit event type that records
 * it. Returns `undefined` for statuses that do not have a 1:1 audit
 * type (draft, ready_to_send, closed, canceled, expired, etc.).
 */
export function mapLifecycleStatusToAuditEventType(
  status: IssuerRequestLifecycleEvent['status'],
): IssuerAuditEventType | undefined {
  switch (status) {
    case 'consent_recorded':
      return 'consent_recorded';
    case 'manual_link_generated':
      return 'manual_link_generated';
    case 'copied_by_requester':
      return 'link_copied';
    case 'sent_by_requester':
      return 'requester_marked_sent';
    case 'viewed_by_issuer':
      return 'issuer_viewed';
    case 'response_received':
      return 'response_received';
    case 'receipt_candidate_created':
      return 'receipt_candidate_created';
    case 'policy_review_pending':
      return 'policy_review_decided';
    case 'psv_receipt_promoted':
      return 'psv_receipt_promoted';
    default:
      return undefined;
  }
}

/**
 * Pure: build an audit event record from the inputs. The default
 * persistence status is `pending_not_written` — callers who want a
 * different status MUST go through a writer (no shortcut).
 */
export function buildIssuerAuditEventRecord(
  input: IssuerAuditWriteInput,
): IssuerAuditEventRecord {
  return {
    eventId: input.eventId,
    correlationId: input.correlation.correlationId,
    requestId: input.correlation.requestId,
    subjectId: input.correlation.subjectId,
    actor: input.actor,
    actorRole: input.actor.role,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    source: input.source,
    persistenceStatus: 'pending_not_written',
    persistenceMode: 'none',
    payloadHash: input.payloadHash ?? '',
    limitationNote: input.limitationNote,
    relatedArtifactId: input.relatedArtifactId,
    replaySafe: input.replaySafe ?? true,
  };
}

export interface IssuerAuditWriter {
  mode: IssuerAuditPersistenceMode;
  /**
   * Pure function: returns the result the writer would have produced
   * without persisting anything. Demo/no-op writers MUST return a
   * status other than `'persisted'`.
   */
  attemptWrite(record: IssuerAuditEventRecord): IssuerAuditWriteResult;
}

/**
 * The reference no-op writer. Returns `demo_not_persisted` for every
 * record, regardless of input. Has zero side effects: no database,
 * no network, no external calls.
 *
 * The truth contract REQUIRES that this implementation cannot return
 * `persisted: true` — that invariant is enforced by tests.
 */
export function createNoopIssuerAuditWriter(
  options?: { mode?: 'demo' | 'noop' | 'none' },
): IssuerAuditWriter {
  const mode = options?.mode ?? 'demo';
  return {
    mode,
    attemptWrite(_record: IssuerAuditEventRecord): IssuerAuditWriteResult {
      // Defensive: ignore the input entirely so no caller-controlled
      // state can flip the writer to "persisted".
      void _record;
      const status: IssuerAuditWriteStatus =
        mode === 'none' ? 'unavailable' : 'demo_not_persisted';
      const message =
        mode === 'none'
          ? 'No audit writer is wired in this environment; record state is unavailable.'
          : 'Demo writer: nothing was persisted. The record is recorded for replay context only.';
      return {
        status,
        mode,
        persisted: false,
        message,
      };
    },
  };
}

/**
 * Pure: derive the persistence status for a record by running it
 * through a writer. Always returns the writer-emitted status —
 * never claims `persisted` unless `result.persisted === true` AND
 * the writer's mode is `'repository'` or `'external'`.
 */
export function getIssuerAuditPersistenceStatus(
  record: IssuerAuditEventRecord,
  writer: IssuerAuditWriter,
): IssuerAuditWriteResult {
  const result = writer.attemptWrite(record);
  if (
    result.persisted === true &&
    writer.mode !== 'repository' &&
    writer.mode !== 'external'
  ) {
    // Defense-in-depth: a non-repository writer cannot return
    // persisted=true. Downgrade to demo_not_persisted with an
    // explanation rather than trust the writer's claim.
    return {
      status: 'demo_not_persisted',
      mode: writer.mode,
      persisted: false,
      message:
        'Writer reported persisted=true but is not a repository/external writer; downgraded to demo_not_persisted by the audit boundary.',
    };
  }
  return result;
}

/**
 * Apply a write attempt to a record, returning a NEW record with the
 * updated persistence status and mode. Does NOT mutate the input.
 */
export function applyIssuerAuditWriteResult(
  record: IssuerAuditEventRecord,
  result: IssuerAuditWriteResult,
): IssuerAuditEventRecord {
  return {
    ...record,
    persistenceStatus: result.status,
    persistenceMode: result.mode,
  };
}

/**
 * Pure: build the lifecycle replay from a timeline plus a writer.
 * For each lifecycle event that has a known audit type, the replay
 * carries one record. Events without a 1:1 audit type are skipped
 * (draft / closed / canceled / expired / consent_required /
 * ready_to_send).
 */
export function buildIssuerLifecycleReplay(
  timeline: IssuerRequestTimeline,
  correlation: IssuerAuditCorrelation,
  writer: IssuerAuditWriter,
): IssuerLifecycleReplay {
  const records: IssuerAuditEventRecord[] = [];
  for (const lifecycleEvent of timeline.events) {
    const eventType = mapLifecycleStatusToAuditEventType(lifecycleEvent.status);
    if (!eventType) continue;
    const baseRecord = buildIssuerAuditEventRecord({
      eventId: lifecycleEvent.eventId,
      correlation,
      actor: lifecycleEvent.actor,
      eventType,
      occurredAt: lifecycleEvent.occurredAt,
      source: lifecycleEvent.source,
    });
    const writeResult = getIssuerAuditPersistenceStatus(baseRecord, writer);
    records.push(applyIssuerAuditWriteResult(baseRecord, writeResult));
  }

  const fullyReplaySafe = records.every((r) => r.replaySafe);

  return {
    requestId: timeline.requestId,
    correlationId: correlation.correlationId,
    events: records,
    disclaimer:
      'Timeline replay shows recorded workflow context. It does not prove clinical truth by itself.',
    fullyReplaySafe,
  };
}

/**
 * Plain-language explanation of a persistence status. Surfaced
 * verbatim by the audit-boundary page.
 */
export function explainIssuerAuditPersistenceStatus(
  status: IssuerAuditWriteStatus,
): string {
  switch (status) {
    case 'pending_not_written':
      return 'Default state. No writer has attempted to persist this record yet.';
    case 'demo_not_persisted':
      return 'A demo or no-op writer ran. No audit row was persisted; the record is replay context only.';
    case 'simulated':
      return 'A writer simulated the persistence path without writing a row. Useful for previewing audit shape; not a real audit trail.';
    case 'persisted':
      return 'A real repository or external writer confirmed a persisted audit row.';
    case 'failed':
      return 'A real writer attempted to persist and failed. The record is not part of any audit trail until a retry succeeds.';
    case 'unavailable':
      return 'No audit writer is wired in this environment. Persistence status is unavailable.';
    default:
      return 'Unknown persistence status.';
  }
}
