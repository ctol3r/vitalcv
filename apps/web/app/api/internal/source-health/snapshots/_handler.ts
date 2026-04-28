/**
 * Internal snapshots-route handler. Lives in a non-route file (`_handler.ts`)
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
import { getAllSnapshots as defaultGetAllSnapshots } from '@/lib/source-health/store/snapshotStore';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';

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

export async function handleSnapshots(
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

/** Test-only shim — invoked directly by route tests with DI'd deps. */
export async function __handleForTests(
  req: Request,
  deps: SnapshotsRouteDeps,
): Promise<NextResponse> {
  return handleSnapshots(req, deps);
}
