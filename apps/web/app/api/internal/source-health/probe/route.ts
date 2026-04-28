/**
 * POST/GET /api/internal/source-health/probe
 *
 * Internal endpoint that runs the source-health probe batch. Triggered by
 * scheduled callers (GitHub Actions cron) via POST with a Bearer token,
 * or by manual operator paths via the x-monitoring-secret header.
 *
 * Returns ONLY safe metadata: snapshots already strip raw upstream payloads
 * at the runProbe layer, and we never echo headers or request bodies.
 */

import { NextResponse } from 'next/server';

import {
  checkAuth,
  readAuthEnv,
  readAuthHeaders,
} from '../_auth';
import { runAllProbes } from '@/lib/source-health/runner/runAllProbes';
import type { RunAllProbesDeps } from '@/lib/source-health/runner/runAllProbes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ProbeRouteDeps {
  runProbes?: (deps?: RunAllProbesDeps) => ReturnType<typeof runAllProbes>;
  authEnv?: ReturnType<typeof readAuthEnv>;
}

async function handle(
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

  // Safe shape: snapshots already use the canonical SourceHealthSnapshot
  // type; runProbe never carries raw payloads or headers. errors[] is a
  // redacted token list. Do not include req body, headers, or env.
  return NextResponse.json(
    {
      snapshots: result.snapshots,
      durationMs: result.durationMs,
      errors: result.errors,
    },
    { status: 200 },
  );
}

export async function GET(req: Request): Promise<NextResponse> {
  return handle(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  return handle(req);
}

/** Test-only export — invoked directly by route tests with DI'd deps. */
export async function __handleForTests(
  req: Request,
  deps: ProbeRouteDeps,
): Promise<NextResponse> {
  return handle(req, deps);
}
