/**
 * POST/GET /api/internal/source-health/probe
 *
 * Internal endpoint that runs the source-health probe batch. Triggered by
 * scheduled callers (GitHub Actions cron) via POST with a Bearer token,
 * or by manual operator paths via the x-monitoring-secret header.
 *
 * Returns ONLY safe metadata: snapshots already strip raw upstream payloads
 * at the runProbe layer, and we never echo headers or request bodies.
 *
 * The handler implementation lives in `_handler.ts` so this file stays
 * narrowly typed to Next.js's allowed Route exports (GET/POST/etc. +
 * `runtime`/`dynamic`). Tests import the `__handleForTests` shim from
 * `_handler.ts`.
 */

import type { NextResponse } from 'next/server';

import { handleProbe } from './_handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  return handleProbe(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  return handleProbe(req);
}
