import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    candidates?: Array<Record<string, any>>;
    filters?: { pslOnly?: boolean; tier1Only?: boolean };
  };
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/matcha/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({ error: 'Invalid JSON from backend' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const candidates = body.candidates || [];
    const pslOnly = Boolean(body.filters?.pslOnly);
    const tier1Only = Boolean(body.filters?.tier1Only);
    const fallback = candidates
      .map((candidate) => {
        const issuerDid = candidate.issuerDid ? String(candidate.issuerDid) : null;
        const pslCredential =
          issuerDid === 'did:web:issuer.psl.vitalcv' ||
          issuerDid === 'did:web:issuer.stateboard.vitalcv';
        const trustTier = issuerDid === 'did:web:issuer.psl.vitalcv' ? 1 : pslCredential ? 2 : null;
        return { ...candidate, issuerDid, pslCredential, trustTier };
      })
      .filter((candidate) => {
        if (pslOnly && !candidate.pslCredential) return false;
        if (tier1Only && candidate.trustTier !== 1) return false;
        return true;
      });
    // eslint-disable-next-line no-console
    console.error('MATCHA filter error (using fallback):', error);
    return NextResponse.json(
      {
        filtersApplied: { pslOnly, tier1Only },
        total: fallback.length,
        results: fallback,
        warning: 'Backend unavailable; served fallback results.',
      },
      { status: 200 },
    );
  }
}
