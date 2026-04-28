/**
 * GET /api/internal/source-health/snapshots
 *
 * Returns the latest snapshot per source from the in-memory store. The store
 * is ephemeral (cold-start resets) — an empty snapshots array is the HONEST
 * answer when no probe has run yet. We never invent snapshots.
 *
 * Returns ONLY safe metadata. No raw upstream payloads, no headers, no PII.
 */

import { NextResponse } from 'next/server';

import {
  checkAuth,
  readAuthEnv,
  readAuthHeaders,
} from '../_auth';
import { getAllSnapshots as defaultGetAllSnapshots } from '@/lib/source-health/store/snapshotStore';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SnapshotsRouteDeps {
  getAllSnapshots?: () => SourceHealthSnapshot[];
  authEnv?: ReturnType<typeof readAuthEnv>;
}

function newestObservedAt(snaps: readonly SourceHealthSnapshot[]): string | null {
  if (snaps.length === 0) return null;
  let newest = snaps[0].observedAt;
  for (const s of snaps) {
    if (s.observedAt > newest) newest = s.observedAt;
  }
  return newest;
}

async function handle(
  req: Request,
  deps: SnapshotsRouteDeps = {},
): Promise<NextResponse> {
  const env = deps.authEnv ?? readAuthEnv();
  const auth = checkAuth(readAuthHeaders(req), env);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const getter = deps.getAllSnapshots ?? defaultGetAllSnapshots;
  const snapshots = getter();

  return NextResponse.json(
    {
      snapshots,
      observedAt: newestObservedAt(snapshots),
    },
    { status: 200 },
  );
}

export async function GET(req: Request): Promise<NextResponse> {
  return handle(req);
}

/** Test-only export — invoked directly by route tests with DI'd deps. */
export async function __handleForTests(
  req: Request,
  deps: SnapshotsRouteDeps,
): Promise<NextResponse> {
  return handle(req, deps);
}
