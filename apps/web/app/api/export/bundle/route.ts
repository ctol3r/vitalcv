/**
 * /api/export/bundle — foundation-tier export bundle
 *
 * GET → application/zip download
 *
 * Truth contract:
 *   - Bundle is foundation-tier; NOT a signed proof pack.
 *   - No PHI or NPI raw values in the output — only redacted summary shape.
 *   - Requires authentication.
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateBundle,
  type BundleInput,
  type RedactedPassportSummary,
  type ReceiptCandidateSummary,
  type AuditEventSummary,
} from '@/lib/export/bundleGenerator';

export const runtime = 'nodejs';

function bundleFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `vitalcv-bundle-${date}.zip`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        error_description: 'Sign in to export a bundle.',
      },
      { status: 401 },
    );
  }

  // Foundation-tier: generate a redacted summary bundle (no live DB reads).
  // Structured data fetch is deferred to a later wave.
  const passportSummary: RedactedPassportSummary = {
    entityType: 'PERSON',
    specialty: req.nextUrl.searchParams.get('specialty') ?? 'Unknown',
    sourcesChecked: [],
    trustBand: 'unscored',
    readinessScore: 0,
    lastCheckedAt: new Date().toISOString(),
  };

  const receiptCandidateSummary: ReceiptCandidateSummary = {
    totalCount: 0,
    byProofTier: {},
    byReviewState: {},
  };

  const auditEventSummary: AuditEventSummary = {
    eventCount: 0,
    dateRange: { earliest: null, latest: null },
  };

  const input: BundleInput = {
    passportSummary,
    receiptCandidateSummary,
    auditEventSummary,
  };

  const zip = generateBundle(input);
  const filename = bundleFilename();

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'no-store',
    },
  });
}
