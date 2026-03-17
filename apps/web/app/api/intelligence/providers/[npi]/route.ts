import { loadProviderDetail } from '@/lib/intelligence/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authFailureStatus,
  buildAuthFailurePayload,
  canReadIntelligence,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../_shared';

export const runtime = 'nodejs';

const NPI_RE = /^\d{10}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const authContext = await resolveIntelligenceAuthContext();

  if (!canReadIntelligence(authContext)) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'write_block');
    return NextResponse.json(buildAuthFailurePayload(authContext), {
      status: authFailureStatus(authContext),
    });
  }

  const { npi } = await params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  try {
    const detail = await loadProviderDetail(npi);
    if (!detail) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load provider detail',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
