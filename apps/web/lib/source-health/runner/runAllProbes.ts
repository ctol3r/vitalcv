/**
 * RELIABILITY-2 — Probe orchestrator.
 *
 * Runs every shipped lane probe sequentially, records the result in
 * the snapshot store, and returns a summary. Never throws.
 *
 * Truth invariants:
 *   1. A LIVE snapshot is produced ONLY by the underlying `runProbe`
 *      classifying a 2xx response. This module never invents LIVE.
 *   2. Synchronous probe failures do not throw out — they produce an
 *      UNKNOWN snapshot for the offending source and an entry in
 *      `errors[]` with a redacted reason string.
 *   3. The summary contains only safe metadata: snapshots already
 *      strip raw payloads at the runProbe layer.
 */

import {
  nppesProbe,
  oigProbe,
  pecosProbe,
  stateBoardProbe,
  type ProbeDeps,
} from '../probes';
import {
  recordSnapshot as defaultRecordSnapshot,
  getAllSnapshots as defaultGetAllSnapshots,
} from '../store/snapshotStore';
import type {
  SourceHealthSnapshot,
  SourceId,
} from '../sourceHealthTypes';

export type ProbeFn = (deps?: ProbeDeps) => Promise<SourceHealthSnapshot>;

interface OrderedProbe {
  sourceId: SourceId;
  probe: ProbeFn;
}

const DEFAULT_PROBES: OrderedProbe[] = [
  { sourceId: 'NPPES', probe: nppesProbe },
  { sourceId: 'OIG_LEIE', probe: oigProbe },
  { sourceId: 'PECOS', probe: pecosProbe },
  { sourceId: 'STATE_BOARD', probe: stateBoardProbe },
];

export interface RunAllProbesStore {
  recordSnapshot: (snap: SourceHealthSnapshot) => void;
  getAllSnapshots: () => SourceHealthSnapshot[];
}

export interface RunAllProbesDeps {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  /** Override the snapshot store (used by tests to isolate state). */
  store?: RunAllProbesStore;
  /** Override the ordered probe list (used by tests). */
  probes?: OrderedProbe[];
}

export interface RunAllProbesResult {
  snapshots: SourceHealthSnapshot[];
  durationMs: number;
  errors: Array<{ sourceId: SourceId; error: string }>;
}

/**
 * Reduce any thrown value to a short, safe token. Raw error objects,
 * stack traces, and free-form messages MUST NOT leak.
 */
function redactError(err: unknown): string {
  if (err == null) return 'unknown_error';
  if (typeof err === 'object') {
    const name = String(
      (err as { name?: unknown }).name ?? '',
    ).toLowerCase();
    if (name.includes('abort')) return 'aborted';
    if (name.includes('timeout')) return 'probe_timeout';
    if (name.includes('typeerror')) return 'network_error';
  }
  return 'redacted_error';
}

export async function runAllProbes(
  deps: RunAllProbesDeps = {},
): Promise<RunAllProbesResult> {
  const now = deps.now ?? (() => new Date());
  const store: RunAllProbesStore = deps.store ?? {
    recordSnapshot: defaultRecordSnapshot,
    getAllSnapshots: defaultGetAllSnapshots,
  };
  const probes = deps.probes ?? DEFAULT_PROBES;

  const probeDeps: ProbeDeps = {};
  if (deps.fetchImpl) probeDeps.fetchImpl = deps.fetchImpl;
  if (deps.now) probeDeps.now = deps.now;
  if (typeof deps.timeoutMs === 'number') {
    probeDeps.timeoutMs = deps.timeoutMs;
  }

  const startedAt = now().getTime();
  const errors: Array<{ sourceId: SourceId; error: string }> = [];

  for (const { sourceId, probe } of probes) {
    let snap: SourceHealthSnapshot;
    try {
      snap = await probe(probeDeps);
    } catch (err) {
      const observedAt = now().toISOString();
      errors.push({ sourceId, error: redactError(err) });
      snap = {
        sourceId,
        state: 'UNKNOWN',
        reason: 'probe_threw',
        lastSuccessAt: null,
        lastErrorAt: observedAt,
        lastLatencyMs: null,
        observedAt,
      };
    }
    try {
      store.recordSnapshot(snap);
    } catch {
      // Store failure must not crash the batch.
      errors.push({ sourceId, error: 'store_record_failed' });
    }
  }

  const finishedAt = now().getTime();
  const durationMs = Math.max(0, finishedAt - startedAt);

  return {
    snapshots: store.getAllSnapshots(),
    durationMs,
    errors,
  };
}
