/**
 * GET /api/runtime/activation
 *
 * Auth required (Clerk session).
 * Returns: RuntimeActivationState
 * No-store cache.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getRuntimeActivationState } from '@/lib/runtime/getRuntimeActivationState';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const state = getRuntimeActivationState();

  return NextResponse.json(state, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
