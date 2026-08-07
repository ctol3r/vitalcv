/**
 * Internal probe-route handler. Lives in a non-route file (`_handler.ts`)
 * so route.ts can stay narrowly typed to Next.js's allowed exports
 * (GET/POST/etc. + `runtime`/`dynamic`). Tests import the
 * `__handleForTests` shim from here.
 */

import { NextResponse } from 'next/server';

import {
  checkAuth,
  readAuthEnv,
  readAuthHeaders,
} from '../_auth';
import { runAllProbes } from '@/lib/source-health/runner/runAllProbes';
import type { RunAllProbesDeps } from '@/lib/source-health/runner/runAllProbes';
import { recordAvailabilitySamples } from '@/lib/source-health/recordAvailabilitySamples';
import type { ProbeSource } from '@/lib/source-health/recordAvailabilitySamples';

export interface ProbeRouteDeps {
  runProbes?: (deps?: RunAllProbesDeps) => ReturnType<typeof runAllProbes>;
  authEnv?: ReturnType<typeof readAuthEnv>;
  recordSamples?: typeof recordAvailabilitySamples;
}

/**
 * D4 — which caller produced this tick.
 *
 * Read from an explicit `?source=` rather than inferred, because the
 * distinction is load-bearing: a night of ten merges produces a burst of
 * `deploy` probes, and counting those as steady scheduled observation would
 * quietly bias every availability figure derived from the ledger. Unknown or
 * absent values fall back to `manual`, which is the honest label for "a human
 * or something we cannot attribute".
 */
function readProbeSource(req: Request): ProbeSource {
  const raw = new URL(req.url).searchParams.get('source');
  return raw === 'cron' || raw === 'deploy' ? raw : 'manual';
}

export async function handleProbe(
  req: Request,
  deps: ProbeRouteDeps = {},
): Promise<NextResponse> {
  const env = deps.authEnv ?? readAuthEnv();
  const auth = checkAuth(readAuthHeaders(req), env);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const runner = deps.runProbes ?? runAllProbes;
  const result = await runner();

  // D4: persist this tick. Best-effort by contract — `recordAvailabilitySamples`
  // swallows its own failures, so a ledger outage degrades to "no new samples"
  // rather than a failed probe. The probe's job is reporting source health; a
  // storage problem must not masquerade as a source problem.
  const record = deps.recordSamples ?? recordAvailabilitySamples;
  const probeSource = readProbeSource(req);
  const ledger = await record(result.snapshots, probeSource);

  return NextResponse.json(
    {
      snapshots: result.snapshots,
      durationMs: result.durationMs,
      errors: result.errors,
      // Surfaced so a silently-failing ledger is visible in the probe's own
      // output instead of only discoverable by noticing missing rows weeks later.
      //
      // `source` echoes the label these rows were STORED under. Without it the
      // attribution is unobservable from outside the database: a caller that
      // forgets `?source=` silently writes `manual`, and the mistake only shows
      // up when the 30-day availability figure is computed off a ledger that
      // cannot tell scheduled observation from a burst of deploy probes.
      // Echoing it means one curl proves the wiring, instead of reading the
      // workflow, the script and the parser and trusting they agree.
      ledger: {
        written: ledger.written,
        failed: ledger.failed,
        source: probeSource,
        ...(ledger.reason ? { reason: ledger.reason } : {}),
      },
    },
    { status: 200 },
  );
}

/** Test-only shim — invoked directly by route tests with DI'd deps. */
export async function __handleForTests(
  req: Request,
  deps: ProbeRouteDeps,
): Promise<NextResponse> {
  return handleProbe(req, deps);
}
