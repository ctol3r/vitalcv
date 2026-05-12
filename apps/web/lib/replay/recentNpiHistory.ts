/**
 * recentNpiHistory — client-side recent-NPI history primitive.
 *
 * Stores the last N NPIs the current browser session has inspected,
 * along with the run_id + checked_at + replay status, so the UI can
 * surface "your recent lookups" without a backend round-trip.
 *
 * Truth contract:
 *   - Storage is localStorage. Cleared when the user clears site data.
 *     NO server-side propagation; this is per-browser, not per-user.
 *     (Per-user history requires authentication + a backend row;
 *     that's a separate scope.)
 *   - Each entry carries:
 *       npi          — 10-digit string
 *       runId        — ingest run id (if known) or null
 *       checkedAt    — ISO timestamp of the lookup
 *       replayState  — typed union (see below); the brief's "replay
 *                      status chip" reads this to render its variant
 *   - The history is BOUNDED. Default max 20 entries. Oldest entries
 *     are dropped when capacity exceeded.
 *   - SSR safe: every operation guards `typeof window === 'undefined'`
 *     and returns the safe-empty result on server-side render.
 *   - Storage version pin: if the shape ever changes, bump
 *     STORAGE_SCHEMA so old entries are dropped rather than coerced.
 *
 * The brief asks for "replay continuity readable to humans." This
 * primitive feeds the chip; pairs with the existing ReplayTimeline
 * (PR #323, unmerged) and ReplayLineage primitives (#312/#313/#330,
 * unmerged) when those land.
 */

export const RECENT_NPI_STORAGE_KEY = 'vitalcv:recent-npi-history:v1';
export const RECENT_NPI_HISTORY_MAX = 20;

/**
 * Mutually-exclusive replay states for the chip. Closed union;
 * new states require explicit code + lockdown update.
 *
 *   - 'no_run_recorded'   — caller has never run an ingest for this NPI
 *   - 'in_flight'         — SSE stream is open / events still arriving
 *   - 'completed_clean'   — passport_ready received, no degraded events
 *   - 'completed_degraded' — done, but some sources failed
 *   - 'failed'            — terminal error before passport_ready
 */
export const REPLAY_STATES = [
  'no_run_recorded',
  'in_flight',
  'completed_clean',
  'completed_degraded',
  'failed',
] as const;
export type ReplayState = (typeof REPLAY_STATES)[number];

export interface RecentNpiEntry {
  readonly npi: string;
  readonly runId: string | null;
  readonly checkedAt: string;
  readonly replayState: ReplayState;
}

interface StorageEnvelope {
  readonly schema: 'vitalcv:recent-npi-history:v1';
  readonly entries: readonly RecentNpiEntry[];
}

const NPI_RE = /^\d{10}$/;

function isValidNpi(npi: unknown): npi is string {
  return typeof npi === 'string' && NPI_RE.test(npi);
}

function isValidEntry(value: unknown): value is RecentNpiEntry {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  if (!isValidNpi(e.npi)) return false;
  if (e.runId !== null && typeof e.runId !== 'string') return false;
  if (typeof e.checkedAt !== 'string' || e.checkedAt.length === 0) return false;
  if (typeof e.replayState !== 'string') return false;
  return (REPLAY_STATES as readonly string[]).includes(e.replayState);
}

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readEnvelope(): StorageEnvelope {
  if (!isStorageAvailable()) {
    return { schema: 'vitalcv:recent-npi-history:v1', entries: [] };
  }
  try {
    const raw = window.localStorage.getItem(RECENT_NPI_STORAGE_KEY);
    if (!raw) return { schema: 'vitalcv:recent-npi-history:v1', entries: [] };
    const parsed = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      parsed.schema !== 'vitalcv:recent-npi-history:v1' ||
      !Array.isArray(parsed.entries)
    ) {
      return { schema: 'vitalcv:recent-npi-history:v1', entries: [] };
    }
    const entries = (parsed.entries as unknown[]).filter(isValidEntry);
    return { schema: 'vitalcv:recent-npi-history:v1', entries };
  } catch {
    return { schema: 'vitalcv:recent-npi-history:v1', entries: [] };
  }
}

function writeEnvelope(envelope: StorageEnvelope): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(RECENT_NPI_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // quota exceeded / serialization error — silent drop is acceptable
    // for a UX-affordance store; the truth contract here is "best
    // effort", NOT "durable record". Real audit lineage lives on the
    // backend via IngestEvent (#319 schema).
  }
}

/** Returns the current history, newest first. SSR-safe. */
export function getRecentNpiHistory(): readonly RecentNpiEntry[] {
  return readEnvelope().entries;
}

/**
 * Records a lookup. If the NPI already exists in history, the old
 * entry is removed and the new one is prepended (move-to-front).
 * Entries beyond `RECENT_NPI_HISTORY_MAX` are dropped.
 */
export function recordRecentNpi(input: {
  npi: string;
  runId?: string | null;
  checkedAt: string;
  replayState: ReplayState;
}): readonly RecentNpiEntry[] {
  // SSR short-circuit: when there's no storage, we cannot record.
  // Return the current (empty) history so callers don't think the
  // entry was persisted. Honest fail-closed: callers re-invoke
  // client-side after hydration.
  if (!isStorageAvailable()) return getRecentNpiHistory();
  if (!isValidNpi(input.npi)) return getRecentNpiHistory();
  const entry: RecentNpiEntry = Object.freeze({
    npi: input.npi,
    runId: input.runId ?? null,
    checkedAt: input.checkedAt,
    replayState: input.replayState,
  });
  const current = readEnvelope().entries;
  const filtered = current.filter((e) => e.npi !== input.npi);
  const next: RecentNpiEntry[] = [entry, ...filtered].slice(0, RECENT_NPI_HISTORY_MAX);
  writeEnvelope({ schema: 'vitalcv:recent-npi-history:v1', entries: next });
  return next;
}

/** Removes a specific NPI from the history. Returns the new list. */
export function forgetRecentNpi(npi: string): readonly RecentNpiEntry[] {
  if (!isValidNpi(npi)) return getRecentNpiHistory();
  const current = readEnvelope().entries;
  const next = current.filter((e) => e.npi !== npi);
  writeEnvelope({ schema: 'vitalcv:recent-npi-history:v1', entries: next });
  return next;
}

/** Clears all history. */
export function clearRecentNpiHistory(): void {
  writeEnvelope({ schema: 'vitalcv:recent-npi-history:v1', entries: [] });
}

/**
 * Narrows an unknown value into a ReplayState. Returns null on
 * unknown input — callers MUST handle this rather than defaulting.
 */
export function narrowReplayState(value: unknown): ReplayState | null {
  if (typeof value !== 'string') return null;
  return (REPLAY_STATES as readonly string[]).includes(value)
    ? (value as ReplayState)
    : null;
}

/**
 * Human-readable label for each state. Used by the chip renderer
 * (and any future history-list surface). Compound labels only —
 * never bare "Verified".
 */
export const REPLAY_STATE_LABEL: Readonly<Record<ReplayState, string>> = Object.freeze({
  no_run_recorded: 'No run on record',
  in_flight: 'Run in progress',
  completed_clean: 'Run complete — source-backed',
  completed_degraded: 'Run complete — partial coverage',
  failed: 'Run failed before completion',
});
