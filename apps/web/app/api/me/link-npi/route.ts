/**
 * POST /api/me/link-npi
 *
 * Links an NPI to the authenticated Clerk user via publicMetadata.
 * Stores { npi: string } in Clerk publicMetadata so it propagates
 * into the session JWT claim on next refresh.
 *
 * Body: { npi: string }
 * Auth: Clerk session required.
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NPI_REGEX = /^\d{10}$/;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { npi?: unknown };
  try {
    body = (await req.json()) as { npi?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
  if (!NPI_REGEX.test(npi)) {
    return NextResponse.json(
      { error: 'npi must be a 10-digit string' },
      { status: 422 },
    );
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(session.userId, {
      publicMetadata: { npi },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update Clerk metadata', detail: String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, npi });
}
