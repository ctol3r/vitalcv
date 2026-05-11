/**
 * Backend replay-lineage primitive — W3-PR212A.
 *
 * Byte-for-byte mirror of `apps/web/lib/trust/replay-lineage.ts`. The
 * web side (shipped in W3-PR210A / PR #312) added `replayLineage` as
 * an optional field on `PassportData`. This module is the backend
 * counterpart: a primitive a response builder can call to construct
 * the lineage from a recorded ingest-event sequence, with the
 * guarantee that the digest matches what the web side recomputes via
 * `verifyReplayLineageDigest`.
 *
 * Correctness contract: the canonical-JSON serialization, the
 * SHA-256 digest, and the comprehensive-flag derivation are all
 * defined identically on both sides. Two implementations of the same
 * function in two trees is a maintenance burden, but importing the
 * web module from the backend pulls in client-only deps (Next, React)
 * — we keep the rule local. A cross-tree byte-equality test pins the
 * invariant.
 */

import { createHash } from 'node:crypto';

export interface ReplayLineageEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly observedAt: string;
  readonly sourceId: string | null;
}

export interface ReplayLineage {
  readonly runId: string;
  readonly eventDigest: string;
  readonly events: readonly ReplayLineageEvent[];
  readonly sealedAt: string;
  readonly comprehensive: boolean;
}

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
  const payload = isRecord(e.payload) ? e.payload : null;
  const explicit = payload && typeof payload.eventId === 'string' ? payload.eventId : null;
  if (explicit) return explicit;
  return `evt-${e.timestamp}-${e.type}-${index}`;
}

/**
 * Deterministic JSON serialization with sorted object keys. Must
 * match the web side at `apps/web/lib/trust/replay-lineage.ts`
 * byte-for-byte — both implementations produce identical output for
 * the same input. The cross-tree test in
 * `__tests__/replayLineage.crossTree.test.ts` pins this.
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

export function verifyReplayLineageDigest(lineage: ReplayLineage): boolean {
  const recomputed = computeEventDigest(lineage.runId, lineage.events);
  return recomputed === lineage.eventDigest;
}
