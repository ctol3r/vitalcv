import { NextResponse } from 'next/server';
import { logEvent, normalizeVerifierRef } from '../../../../lib/events';

/**
 * NPI Lookup API — Mock Implementation
 *
 * Deterministic mock logic:
 * - NPI starting with "1" → exists (active provider)
 * - All others → does not exist (unknown)
 *
 * Response shape matches the future real API contract so the
 * frontend won't need changes when we wire up NPPES.
 */

interface NpiLookupResponse {
  exists: boolean;
  status: 'active' | 'unknown';
  lastUpdated: string;
  source: 'mock';
}

const NPI_PATTERN = /^\d{10}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ npi: string }> },
): Promise<NextResponse<NpiLookupResponse | { error: string }>> {
  const { npi } = await params;
  const ref = normalizeVerifierRef(new URL(request.url).searchParams.get('ref'));

  // ── Validate ──
  if (!NPI_PATTERN.test(npi)) {
    return NextResponse.json(
      { error: 'NPI must be exactly 10 digits' },
      { status: 400 },
    );
  }

  // ── Mock resolution ──
  const exists = npi.startsWith('1');

  // Fire-and-forget event logging
  void logEvent('npi_lookup', npi, {
    exists,
    ...(ref ? { ref } : {}),
  });

  return NextResponse.json({
    exists,
    status: exists ? 'active' : 'unknown',
    lastUpdated: new Date().toISOString(),
    source: 'mock',
  });
}
