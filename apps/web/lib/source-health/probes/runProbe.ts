import type {
  SourceHealthSnapshot,
  SourceHealthState,
  SourceId,
} from '../sourceHealthTypes';

export interface ProbeDeps {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

export interface ProbeFetchOutcome {
  status?: number; // HTTP status when a response was received
  ok?: boolean;
  error?: unknown; // network error, abort, etc.
  timedOut?: boolean;
}

export type ProbeFetcher = (input: {
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}) => Promise<ProbeFetchOutcome>;

const DEFAULT_TIMEOUT_MS = 5_000;

function classify(outcome: ProbeFetchOutcome): {
  state: SourceHealthState;
  reason: string;
} {
  if (outcome.timedOut) {
    return { state: 'UNAVAILABLE', reason: 'probe_timeout' };
  }
  if (outcome.error !== undefined) {
    return { state: 'UNAVAILABLE', reason: 'network_error' };
  }
  const status = outcome.status;
  if (typeof status !== 'number') {
    return { state: 'UNKNOWN', reason: 'no_status' };
  }
  if (status === 429) {
    return { state: 'RATE_LIMITED', reason: 'http_429' };
  }
  if (status >= 200 && status < 300) {
    return { state: 'LIVE', reason: `http_${status}` };
  }
  if (status >= 500 && status < 600) {
    return { state: 'DEGRADED', reason: `http_${status}` };
  }
  return { state: 'UNKNOWN', reason: `http_${status}` };
}

/**
 * Runs a probe and translates the outcome into a SourceHealthSnapshot.
 *
 * Guarantees:
 *  - never throws (errors are absorbed and reflected as UNAVAILABLE/UNKNOWN)
 *  - records `observedAt` and `lastLatencyMs`
 *  - dependency-injects fetch, clock, and timeout for tests
 */
export async function runProbe(
  sourceId: SourceId,
  fetcher: ProbeFetcher,
  deps: ProbeDeps = {},
): Promise<SourceHealthSnapshot> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const startedAt = now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let outcome: ProbeFetchOutcome;
  try {
    outcome = await fetcher({ fetchImpl, signal: controller.signal });
    if (timedOut) {
      outcome = { ...outcome, timedOut: true };
    }
  } catch (error) {
    outcome = timedOut
      ? { timedOut: true }
      : { error: error ?? new Error('unknown_probe_error') };
  } finally {
    clearTimeout(timer);
  }

  const finishedAt = now();
  const lastLatencyMs = Math.max(
    0,
    finishedAt.getTime() - startedAt.getTime(),
  );
  const observedAt = finishedAt.toISOString();
  const { state, reason } = classify(outcome);

  return {
    sourceId,
    state,
    reason,
    lastSuccessAt: state === 'LIVE' ? observedAt : null,
    lastErrorAt: state === 'LIVE' ? null : observedAt,
    lastLatencyMs,
    observedAt,
  };
}
