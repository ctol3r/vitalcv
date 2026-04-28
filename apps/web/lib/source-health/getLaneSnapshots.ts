import { getAllSnapshots } from './store/snapshotStore';
import {
  ALL_SOURCE_IDS,
  type SourceHealthSnapshot,
  type SourceId,
} from './sourceHealthTypes';

/**
 * Returns lane snapshots for surfaces that consume source health.
 *
 * Order of precedence:
 *   1. Snapshots present in the in-memory store (set by the probe runner).
 *      Sources missing from the store fall through to the placeholder seed
 *      below.
 *   2. Placeholder seed: UNKNOWN for every source. This is the HONEST
 *      default before any probe has run. It NEVER returns LIVE.
 *
 * Truth invariants:
 *   - The placeholder seed must remain UNKNOWN for every source. LIVE
 *     can only originate from a confirmed 2xx probe response.
 *   - Cold-start (empty store) → 4×UNKNOWN. Tests assert this.
 *   - State board lane has no live adapter; it always falls through to
 *     UNKNOWN with a "no_generic_state_board_probe_wired" reason.
 */
export function getLaneSnapshots(
  options: { now?: () => Date } = {},
): SourceHealthSnapshot[] {
  const now = options.now ?? (() => new Date());
  const observedAt = now().toISOString();

  const stored = getAllSnapshots();
  const byId = new Map<SourceId, SourceHealthSnapshot>();
  for (const snap of stored) byId.set(snap.sourceId, snap);

  return ALL_SOURCE_IDS.map((sourceId) => {
    const fromStore = byId.get(sourceId);
    if (fromStore) return fromStore;
    return placeholderSeed(sourceId, observedAt);
  });
}

function placeholderSeed(
  sourceId: SourceId,
  observedAt: string,
): SourceHealthSnapshot {
  if (sourceId === 'STATE_BOARD') {
    return {
      sourceId,
      state: 'UNKNOWN',
      reason: 'no_generic_state_board_probe_wired',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastLatencyMs: null,
      observedAt,
    };
  }
  return {
    sourceId,
    state: 'UNKNOWN',
    reason: 'placeholder_seed_no_live_probe',
    lastSuccessAt: null,
    lastErrorAt: null,
    lastLatencyMs: null,
    observedAt,
  };
}
