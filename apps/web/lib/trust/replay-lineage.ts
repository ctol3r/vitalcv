/**
 * Passport replay lineage — W3-PR210A.
 *
 * Adds a public, artifact-embeddable representation of the SSE event
 * sequence that produced a `PassportData` payload. Without this, the
 * passport contract is a snapshot without provenance — a verifier
 * cannot prove from the artifact alone that readiness was derived
 * from real federal source events.
 *
 * Truth-contract invariants:
 *   - `events` is ordered (insertion order matches SSE emission order).
 *   - `eventDigest` is a deterministic SHA-256 over the canonical
 *     JSON of {runId, events[]} so two callers with the same input
 *     produce byte-identical digests.
 *   - `comprehensive` is derived from the events list — never
 *     hardcoded. A passport whose `sources.checked` includes a source
 *     for which no `source_complete` event appears is NOT
 *     comprehensive.
 *   - Missing / malformed input → null. We never synthesize a lineage
 *     from inference.
 *
 * Doctrine link: governance-runtime tamper-evident-persistence — same
 * canonical-JSON-then-SHA-256 pattern as the sealed ledger.
 */

import { createHash } from 'node:crypto';

export interface ReplayLineageEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly observedAt: string;
  readonly sourceId: string | null;
}

export interface ReplayLineage {
  /** Ingestion run identifier — keys the SSE stream that produced this. */
  readonly runId: string;
  /** SHA-256 hex of canonical-JSON({runId, events}). */
  readonly eventDigest: string;
  /** Ordered events that produced the passport. */
  readonly events: readonly ReplayLineageEvent[];
  /** ISO timestamp when the lineage was sealed. */
  readonly sealedAt: string;
  /**
   * True when every source the passport claims as checked has a
   * corresponding `source_complete` event in the lineage. If any
   * claimed source has no event, this is false — the lineage
   * surfaces the gap rather than hiding it.
   */
  readonly comprehensive: boolean;
}

/**
 * Shape of the SSE event we accept as input. Matches `IngestEvent`
 * structurally (`apps/web/hooks/ingestStreamState.ts`) but typed
 * loosely so this module does not depend on the client-only hook
 * module.
 */
export interface IngestEventLike {
  readonly type: string;
  readonly sourceId?: string;
  readonly timestamp: string;
  readonly payload?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function eventIdFor(e: IngestEventLike, index: number): string {
  // Prefer an explicit payload.eventId; otherwise derive a deterministic
  // id from {timestamp, type, index} so two callers with the same event
  // stream produce the same digest.
  const payload = isRecord(e.payload) ? e.payload : null;
  const explicit = payload && typeof payload.eventId === 'string' ? payload.eventId : null;
  if (explicit) return explicit;
  return `evt-${e.timestamp}-${e.type}-${index}`;
}

/**
 * Deterministic JSON serialization with sorted object keys, used to
 * produce a stable digest input. We deliberately do NOT depend on the
 * governance-runtime `canonicalize` here — replicating the rule
 * locally keeps the web bundle from importing server-only code.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
    .join(',');
  return '{' + body + '}';
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function computeEventDigest(
  runId: string,
  events: readonly ReplayLineageEvent[],
): string {
  return sha256Hex(canonicalJson({ runId, events }));
}

/**
 * Builds a `ReplayLineage` from an ingest-stream event sequence.
 *
 * Returns null when the input is structurally insufficient — no
 * runId, no events, or every event missing a timestamp. We never
 * fabricate a lineage from inference.
 */
export function buildReplayLineage(input: {
  runId: string | null | undefined;
  events: readonly IngestEventLike[];
  claimedSources?: readonly string[];
  nowIso: string;
}): ReplayLineage | null {
  if (!input.runId || input.runId.length === 0) return null;
  if (!Array.isArray(input.events) || input.events.length === 0) return null;

  const events: ReplayLineageEvent[] = [];
  for (let i = 0; i < input.events.length; i++) {
    const e = input.events[i];
    if (!e || typeof e.timestamp !== 'string' || typeof e.type !== 'string') {
      // Skip malformed events rather than null-the-whole-lineage. The
      // surviving events still constitute a valid (partial) trace.
      continue;
    }
    events.push(
      Object.freeze({
        eventId: eventIdFor(e, i),
        eventType: e.type,
        observedAt: e.timestamp,
        sourceId: typeof e.sourceId === 'string' ? e.sourceId : null,
      }),
    );
  }

  if (events.length === 0) return null;

  // Comprehensive iff every claimed source has at least one
  // `source_complete` event in the trace. When claimedSources is
  // absent we default to true — caller has not pinned a coverage
  // expectation.
  let comprehensive = true;
  if (input.claimedSources && input.claimedSources.length > 0) {
    const completedSources = new Set<string>();
    for (const e of events) {
      if (e.eventType === 'source_complete' && e.sourceId !== null) {
        completedSources.add(e.sourceId);
      }
    }
    for (const src of input.claimedSources) {
      if (!completedSources.has(src)) {
        comprehensive = false;
        break;
      }
    }
  }

  const frozenEvents = Object.freeze(events);
  return Object.freeze({
    runId: input.runId,
    eventDigest: computeEventDigest(input.runId, frozenEvents),
    events: frozenEvents,
    sealedAt: input.nowIso,
    comprehensive,
  });
}

/**
 * Structural narrowing for a payload that may carry a lineage. Used
 * by `normalizePassportData` to round-trip the field rather than
 * silently dropping it at the boundary.
 *
 * Returns null when required fields are missing/malformed — we never
 * synthesize a partial lineage.
 */
export function normalizeReplayLineage(raw: unknown): ReplayLineage | null {
  if (!isRecord(raw)) return null;
  const runId = typeof raw.runId === 'string' && raw.runId.length > 0 ? raw.runId : null;
  const sealedAt = typeof raw.sealedAt === 'string' && raw.sealedAt.length > 0 ? raw.sealedAt : null;
  const eventDigest = typeof raw.eventDigest === 'string' && raw.eventDigest.length > 0 ? raw.eventDigest : null;
  const eventsRaw = Array.isArray(raw.events) ? raw.events : null;
  if (!runId || !sealedAt || !eventDigest || !eventsRaw) return null;

  const events: ReplayLineageEvent[] = [];
  for (const e of eventsRaw) {
    if (!isRecord(e)) continue;
    const eventId = typeof e.eventId === 'string' ? e.eventId : null;
    const eventType = typeof e.eventType === 'string' ? e.eventType : null;
    const observedAt = typeof e.observedAt === 'string' ? e.observedAt : null;
    if (!eventId || !eventType || !observedAt) continue;
    events.push(
      Object.freeze({
        eventId,
        eventType,
        observedAt,
        sourceId: typeof e.sourceId === 'string' ? e.sourceId : null,
      }),
    );
  }
  if (events.length === 0) return null;

  const comprehensive = typeof raw.comprehensive === 'boolean' ? raw.comprehensive : false;

  return Object.freeze({
    runId,
    eventDigest,
    events: Object.freeze(events),
    sealedAt,
    comprehensive,
  });
}

/**
 * True iff the lineage's digest matches a recomputation over its own
 * events. Used by verifiers to detect tampering — the digest is the
 * artifact-side proof of integrity.
 */
export function verifyReplayLineageDigest(lineage: ReplayLineage): boolean {
  const recomputed = computeEventDigest(lineage.runId, lineage.events);
  return recomputed === lineage.eventDigest;
}
