import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getApiBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

/**
 * Shared proxy for the CC-08 Workbench sub-resources (revisions, restore,
 * links, backlinks). Same contract as every garden proxy: identity from the
 * Clerk session — never a caller header — body passed through untouched,
 * backend status returned as-is, failures honest (503, never fake data).
 */
export async function proxyGardenPath(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: string,
): Promise<NextResponse> {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = getApiBase();
  if (!base) {
    return NextResponse.json({ error: 'Workbench storage is not configured.' }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: await buildMarketplaceHeaders(
        session,
        method === 'POST' && body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      ),
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Workbench storage is temporarily unavailable.' }, { status: 503 });
  }
}
