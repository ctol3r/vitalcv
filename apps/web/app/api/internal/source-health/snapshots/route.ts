/**
 * GET /api/internal/source-health/snapshots
 *
 * Returns the latest snapshot per source from the in-memory store. The store
 * is ephemeral (cold-start resets) — an empty snapshots array is the HONEST
 * answer when no probe has run yet. We never invent snapshots.
 *
 * Returns ONLY safe metadata. No raw upstream payloads, no headers, no PII.
 *
 * The handler implementation lives in `_handler.ts` so this file stays
 * narrowly typed to Next.js's allowed Route exports.
 */

import type { NextResponse } from 'next/server';

import { handleSnapshots } from './_handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  return handleSnapshots(req);
}
