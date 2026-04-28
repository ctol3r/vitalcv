/**
 * RELIABILITY-2 — In-memory snapshot store.
 *
 * Module-scope cache of the most recent SourceHealthSnapshot per source.
 * Ephemeral: serverless cold starts will reset this. Acceptable for v1
 * per the brief; durable persistence is the next layer.
 *
 * Truth invariants (do not weaken):
 *   1. `lastSuccessAt` is ONLY advanced on a LIVE snapshot. Non-LIVE
 *      snapshots carry forward the prior `lastSuccessAt` if their own
 *      is null.
 *   2. `lastErrorAt` is updated whenever the new state is a degraded
 *      one (DEGRADED, UNAVAILABLE, RATE_LIMITED).
 *   3. Read order is deterministic: canonical ordering of SourceId.
 *   4. Store stores ONLY safe metadata that already lives on
 *      SourceHealthSnapshot. No raw payloads, headers, or PII.
 */

import {
  ALL_SOURCE_IDS,
  type SourceHealthSnapshot,
  type SourceId,
} from '../sourceHealthTypes';

const store = new Map<SourceId, SourceHealthSnapshot>();

const DEGRADED_STATES = new Set<SourceHealthSnapshot['state']>([
  'DEGRADED',
  'UNAVAILABLE',
  'RATE_LIMITED',
]);

/**
 * Record a new snapshot, applying carry-forward rules.
 *
 * - LIVE: set lastSuccessAt = observedAt; do not touch lastErrorAt
 *   from prior (the new snapshot's own lastErrorAt wins, which for
 *   a LIVE snapshot from runProbe is null).
 * - Non-LIVE with null lastSuccessAt: preserve prior lastSuccessAt.
 * - DEGRADED/UNAVAILABLE/RATE_LIMITED: ensure lastErrorAt is set
 *   (default to observedAt if the incoming snapshot has none).
 */
export function recordSnapshot(snap: SourceHealthSnapshot): void {
  const prior = store.get(snap.sourceId);

  let lastSuccessAt = snap.lastSuccessAt;
  if (snap.state === 'LIVE') {
    lastSuccessAt = snap.observedAt;
  } else if (lastSuccessAt === null && prior) {
    lastSuccessAt = prior.lastSuccessAt;
  }

  let lastErrorAt = snap.lastErrorAt;
  if (DEGRADED_STATES.has(snap.state)) {
    if (lastErrorAt === null) {
      lastErrorAt = snap.observedAt;
    }
  }

  const next: SourceHealthSnapshot = {
    sourceId: snap.sourceId,
    state: snap.state,
    reason: snap.reason,
    lastSuccessAt,
    lastErrorAt,
    lastLatencyMs: snap.lastLatencyMs,
    observedAt: snap.observedAt,
  };

  store.set(snap.sourceId, next);
}

/**
 * Returns all snapshots in canonical SourceId order.
 * Sources with no recorded snapshot are omitted (honest: empty when cold).
 */
export function getAllSnapshots(): SourceHealthSnapshot[] {
  const out: SourceHealthSnapshot[] = [];
  for (const id of ALL_SOURCE_IDS) {
    const snap = store.get(id);
    if (snap) out.push(snap);
  }
  return out;
}

export function getSnapshot(
  sourceId: SourceId,
): SourceHealthSnapshot | undefined {
  return store.get(sourceId);
}

/** Test-only — clears the module store. */
export function clearAllSnapshots(): void {
  store.clear();
}
