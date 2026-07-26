/**
 * POST /api/internal/release-monitor/webhook
 *
 * Receiver for the Railway deploy webhook (Project → Webhooks). On a
 * web-service SUCCESS deploy it fires a GitHub `repository_dispatch` to run the
 * external release-verify workflow. See `_handler.ts` for the logic and
 * `docs/deployment/release-monitoring.md` for the Railway setup.
 *
 * The handler lives in `_handler.ts` so this file stays narrowly typed to the
 * route exports Next.js allows; tests import `__handleForTests` from there.
 */

import type { NextResponse } from 'next/server';
import { NextResponse as Res } from 'next/server';

import { handleWebhook } from './_handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  return handleWebhook(req);
}

export function GET(): NextResponse {
  return Res.json({ error: 'method not allowed', hint: 'Railway posts deploy events here' }, { status: 405 });
}
