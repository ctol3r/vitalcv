/**
 * /api/pilot/proof-pack — Pilot proof-pack export route
 *
 * POST: Accepts an array of ApplicationSnapshot objects and returns a
 * deterministic buyer-legible proof-pack artifact. Partial data is
 * preserved as partial — limitation lines are honored, medians
 * collapse to null when endpoints are missing.
 *
 * GET: Returns a proof pack for a zero-application set (demonstrates
 * the "no applications" limitation response — useful for operators
 * validating the export contract without supplying snapshots).
 *
 * Query / body options:
 *   - `download=json` — sets Content-Disposition for browser download.
 *   - `readiness` (POST body, optional) — Record<applicationId, ISO string>
 *     used to populate readinessAt timestamps when the snapshot audit
 *     log does not carry them.
 *
 * Doctrine (from Wave 243 mission):
 *   - Deterministic output for identical input (serializePilotProofPack).
 *   - Partial data stays partial — never upgraded to decision-grade.
 *   - Limitation lines are always surfaced when any metric is null.
 *   - Response shape is stable for diffable buyer deliverables.
 */

import { NextResponse } from 'next/server';
import {
  buildPilotProofPack,
  serializePilotProofPack,
  type PilotProofPack,
} from '@/lib/proof/pilot-proof-pack';
import type { ApplicationSnapshot } from '@/lib/apply/application-snapshot';

interface ProofPackRequestBody {
  applications?: ApplicationSnapshot[];
  readiness?: Record<string, string | null>;
  generatedAt?: string;
}

interface ProofPackResponse {
  pack: PilotProofPack;
  /** Deterministic serialization of `pack` for buyer deliverables. */
  serialized: string;
}

function isApplicationSnapshot(value: unknown): value is ApplicationSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.applicationId === 'string'
    && typeof v.subjectId === 'string'
    && typeof v.employerId === 'string'
    && typeof v.roleId === 'string'
    && typeof v.snapshotHash === 'string'
    && Array.isArray(v.includedLanes)
    && Array.isArray(v.includedClaims)
    && typeof v.proofTier === 'string'
    && typeof v.completeness === 'number'
    && typeof v.createdAt === 'string'
    && typeof v.status === 'string'
    && Array.isArray(v.auditLog)
  );
}

function readDownloadParam(req: Request): string | null {
  // Use plain URL parsing rather than NextRequest.nextUrl so the route
  // is test-friendly under raw `new Request(url)` fixtures.
  try {
    return new URL(req.url).searchParams.get('download');
  } catch {
    return null;
  }
}

function downloadResponse(
  serialized: string,
  generatedAt: string,
): NextResponse {
  const filename = `vitalcv-pilot-proof-pack-${generatedAt.slice(0, 10)}.json`;
  return new NextResponse(serialized, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: ProofPackRequestBody;
  try {
    body = (await req.json()) as ProofPackRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body. Expected { applications, readiness?, generatedAt? }.' },
      { status: 400 },
    );
  }

  const applications = Array.isArray(body.applications) ? body.applications : [];
  const invalid = applications.findIndex((a) => !isApplicationSnapshot(a));
  if (invalid !== -1) {
    return NextResponse.json(
      {
        error: `applications[${invalid}] does not match the ApplicationSnapshot contract. Each entry requires applicationId, subjectId, employerId, roleId, snapshotHash, includedLanes, includedClaims, proofTier, completeness, createdAt, status, auditLog.`,
      },
      { status: 400 },
    );
  }

  const { pack } = buildPilotProofPack({
    applications,
    readinessByApplication: body.readiness,
    generatedAt: body.generatedAt,
  });
  const serialized = serializePilotProofPack(pack);

  if (readDownloadParam(req) === 'json') {
    return downloadResponse(serialized, pack.generatedAt);
  }

  const response: ProofPackResponse = { pack, serialized };
  return NextResponse.json(response, { status: 200 });
}

/**
 * GET variant — zero-application pack. Demonstrates the honest-partial
 * response when no evidence is available. Useful for operators
 * validating the export route contract before real snapshots exist.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const { pack } = buildPilotProofPack({ applications: [] });
  const serialized = serializePilotProofPack(pack);

  if (readDownloadParam(req) === 'json') {
    return downloadResponse(serialized, pack.generatedAt);
  }

  const response: ProofPackResponse = { pack, serialized };
  return NextResponse.json(response, { status: 200 });
}
