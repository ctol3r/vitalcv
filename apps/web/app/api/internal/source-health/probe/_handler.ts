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

export interface ProbeRouteDeps {
  runProbes?: (deps?: RunAllProbesDeps) => ReturnType<typeof runAllProbes>;
  authEnv?: ReturnType<typeof readAuthEnv>;
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

  return NextResponse.json(
    {
      snapshots: result.snapshots,
      durationMs: result.durationMs,
      errors: result.errors,
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
