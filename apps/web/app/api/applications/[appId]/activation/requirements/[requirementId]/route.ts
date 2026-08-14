import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
const PRIVATE_RESPONSE = { 'Cache-Control': 'private, no-store' } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; requirementId: string }> },
) {
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_RESPONSE });
  const { appId, requirementId } = await params;
  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/applications/${encodeURIComponent(appId)}/activation/requirements/${encodeURIComponent(requirementId)}`,
      {
        method: 'PATCH',
        headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
        body: await req.text(),
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      },
    );
    return NextResponse.json(await response.json().catch(() => ({})), { status: response.status, headers: PRIVATE_RESPONSE });
  } catch {
    return NextResponse.json({ error: 'Requirement update is temporarily unavailable.' }, { status: 503, headers: PRIVATE_RESPONSE });
  }
}
