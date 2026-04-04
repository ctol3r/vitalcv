import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { BACKEND_URL as BACKEND } from '@/lib/backend-url';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  const { npi } = await context.params;

  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'Invalid NPI.' }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND}/api/employer-review/npi/${npi}/refresh-requests`,
    { headers: { Accept: 'application/json' } },
  );

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { hasPendingRequest: false, count: 0, latestAt: null }, {
    status: response.ok ? 200 : response.status,
  });
}
