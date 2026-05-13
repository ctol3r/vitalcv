/**
 * replayIntegrity.ts — Replay chain validation and integrity analysis.
 *
 * Pure functions — no DB calls, no fetches.
 * Accepts pre-loaded entries and emits structured integrity reports.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReplayChainEntry {
  runId: string;           // 8-char deterministic hash
  checkedAt: string;       // ISO timestamp
  laneId: string;
  priorRunId: string | null;
  signerKid: string | null;
  actorId: string | null;
}

export interface ReplayIntegrityReport {
  chain_valid: boolean;
  anomaly_count: number;
  chronology_continuous: boolean;
  replay_deterministic: boolean;

  // Details
  entries: ReplayChainEntry[];
  anomalies: ReplayAnomaly[];
  gaps: ReplayGapRecord[];
  signerTransitions: SignerTransitionRecord[];
}

export interface ReplayAnomaly {
  type: 'orphan_run' | 'broken_chain' | 'actor_mismatch' | 'duplicate_runId' | 'timestamp_inversion';
  severity: 'warning' | 'critical';
  affectedRunId: string;
  description: string;
}

export interface ReplayGapRecord {
  afterRunId: string;
  gapMs: number;
  gapDays: number;
  gapType: 'data_gap' | 'expected_gap';
}

export interface SignerTransitionRecord {
  fromKid: string | null;
  toKid: string;
  atRunId: string;
  atTs: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default expected window: 24 hours in ms */
const DEFAULT_EXPECTED_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── Core: djb2 hash for runId derivation ──────────────────────────────────────

/**
 * djb2-style hash for runId derivation — matches the client-side implementation.
 * Returns an 8-character lowercase hex string.
 */
export function deriveRunId(laneId: string, npi: string, checkedAtMs: number): string {
  const input = `${laneId}:${npi}:${checkedAtMs}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // djb2: hash * 33 ^ charCode
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    // Keep within 32-bit unsigned range
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Gap detection ─────────────────────────────────────────────────────────────

/**
 * Detects continuity gaps (intervals > expectedWindowMs between entries).
 * Entries must be sorted by checkedAt ascending.
 */
export function detectContinuityGaps(
  entries: ReplayChainEntry[],
  expectedWindowMs: number = DEFAULT_EXPECTED_WINDOW_MS,
): ReplayGapRecord[] {
  const gaps: ReplayGapRecord[] = [];

  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];

    const prevTs = new Date(prev.checkedAt).getTime();
    const currTs = new Date(curr.checkedAt).getTime();
    const gapMs = currTs - prevTs;

    if (gapMs > expectedWindowMs) {
      gaps.push({
        afterRunId: prev.runId,
        gapMs,
        gapDays: gapMs / (24 * 60 * 60 * 1000),
        gapType: 'data_gap',
      });
    } else {
      gaps.push({
        afterRunId: prev.runId,
        gapMs,
        gapDays: gapMs / (24 * 60 * 60 * 1000),
        gapType: 'expected_gap',
      });
    }
  }

  return gaps;
}

// ── Signer transition detection ───────────────────────────────────────────────

/**
 * Detects signer transitions (kid changes between entries).
 * Entries must be sorted by checkedAt ascending.
 */
export function detectSignerTransitions(entries: ReplayChainEntry[]): SignerTransitionRecord[] {
  const transitions: SignerTransitionRecord[] = [];

  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];

    if (curr.signerKid !== null && curr.signerKid !== prev.signerKid) {
      transitions.push({
        fromKid: prev.signerKid,
        toKid: curr.signerKid,
        atRunId: curr.runId,
        atTs: curr.checkedAt,
      });
    }
  }

  return transitions;
}

// ── Main: validateReplayChain ─────────────────────────────────────────────────

/**
 * Validates the replay hash chain.
 *
 * - Derives expected runId for each entry via deriveRunId(laneId, npi, checkedAtMs)
 * - Checks priorRunId matches the previous entry's runId
 * - Detects orphan runs (priorRunId set but no matching prior entry)
 * - Detects timestamp inversions (entry checkedAt < priorEntry checkedAt)
 * - Detects duplicate runIds
 */
export function validateReplayChain(
  entries: ReplayChainEntry[],
  npi: string,
): ReplayIntegrityReport {
  // 1. Sort entries by checkedAt ascending
  const sorted = [...entries].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
  );

  const anomalies: ReplayAnomaly[] = [];

  // Build index for quick lookup
  const runIdIndex = new Map<string, ReplayChainEntry>();
  const seenRunIds = new Set<string>();

  for (const entry of sorted) {
    if (seenRunIds.has(entry.runId)) {
      anomalies.push({
        type: 'duplicate_runId',
        severity: 'critical',
        affectedRunId: entry.runId,
        description: `Duplicate runId detected: ${entry.runId}. Multiple entries share the same identifier.`,
      });
    } else {
      seenRunIds.add(entry.runId);
      runIdIndex.set(entry.runId, entry);
    }
  }

  // 2. Validate each entry
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;

    // Derive expected runId
    const checkedAtMs = new Date(entry.checkedAt).getTime();
    const expectedRunId = deriveRunId(entry.laneId, npi, checkedAtMs);

    // Check runId mismatch → broken_chain
    if (entry.runId !== expectedRunId) {
      anomalies.push({
        type: 'broken_chain',
        severity: 'critical',
        affectedRunId: entry.runId,
        description: `runId mismatch: stored=${entry.runId}, expected=${expectedRunId} (derived from laneId=${entry.laneId}, npi=${npi}, ts=${entry.checkedAt})`,
      });
    }

    // Check priorRunId linkage
    if (entry.priorRunId !== null) {
      const priorEntry = runIdIndex.get(entry.priorRunId);
      if (!priorEntry) {
        anomalies.push({
          type: 'orphan_run',
          severity: 'critical',
          affectedRunId: entry.runId,
          description: `Orphan run: priorRunId=${entry.priorRunId} references an entry not present in the chain.`,
        });
      }
    }

    // Check timestamp inversion
    if (prev !== null) {
      const prevTs = new Date(prev.checkedAt).getTime();
      const currTs = new Date(entry.checkedAt).getTime();
      if (currTs < prevTs) {
        anomalies.push({
          type: 'timestamp_inversion',
          severity: 'critical',
          affectedRunId: entry.runId,
          description: `Timestamp inversion: entry ${entry.runId} (${entry.checkedAt}) is earlier than preceding entry ${prev.runId} (${prev.checkedAt}).`,
        });
      }

      // Check actor mismatch (same laneId, different actorId)
      if (
        entry.laneId === prev.laneId &&
        entry.actorId !== null &&
        prev.actorId !== null &&
        entry.actorId !== prev.actorId
      ) {
        anomalies.push({
          type: 'actor_mismatch',
          severity: 'warning',
          affectedRunId: entry.runId,
          description: `Actor mismatch in lane ${entry.laneId}: previous actorId=${prev.actorId}, current actorId=${entry.actorId}.`,
        });
      }
    }
  }

  // 3. Detect gaps
  const gaps = detectContinuityGaps(sorted);

  // 4. Detect signer transitions
  const signerTransitions = detectSignerTransitions(sorted);

  // 5. Compute summary flags
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
  const chain_valid = criticalAnomalies.length === 0;
  const chronology_continuous = gaps.every((g) => g.gapType === 'expected_gap');
  const replay_deterministic = anomalies.filter((a) => a.type === 'broken_chain').length === 0;

  return {
    chain_valid,
    anomaly_count: anomalies.length,
    chronology_continuous,
    replay_deterministic,
    entries: sorted,
    anomalies,
    gaps,
    signerTransitions,
  };
}
