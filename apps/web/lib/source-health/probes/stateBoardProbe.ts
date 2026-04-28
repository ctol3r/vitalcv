import type { SourceHealthSnapshot } from '../sourceHealthTypes';
import { runProbe, type ProbeDeps } from './runProbe';

/**
 * State licensing boards are NOT a single endpoint. There are 50+ jurisdictions
 * each with their own portal, many without machine-readable APIs. This probe
 * is intentionally conservative: it does not pretend to have a generic check.
 *
 * Until per-state probes are wired in, this returns an UNKNOWN-shaped outcome
 * (no status), which `runProbe` maps to `state = UNKNOWN`. This is the honest
 * answer — we do not know.
 */
export async function probe(deps: ProbeDeps = {}): Promise<SourceHealthSnapshot> {
  return runProbe(
    'STATE_BOARD',
    async () => {
      // Intentionally no network call; per-state probes are not yet wired.
      return { /* no status, no error */ };
    },
    deps,
  );
}
