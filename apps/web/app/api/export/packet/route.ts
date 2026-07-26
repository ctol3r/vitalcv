import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as BACKEND } from '@/lib/backend-url';
import {
  resolveEmployerPacketExportGate,
  type ExportGateEvaluation,
} from '@/lib/export/export-gating';
import {
  employerProofPacketFilename,
} from '@/lib/export/employer-proof-packet';
import { renderEmployerProofPacketPdf } from '@/lib/export/employer-proof-packet-pdf';
import { assertPassportData } from '@/lib/trust/passport-contract';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'unauthorized',
      error_description: 'Sign in with an employer workspace to continue.',
    },
    { status: 401 },
  );
}

function exportGateHeaders(gate: ExportGateEvaluation): HeadersInit {
  return {
    'X-VitalCV-Export-Gate': gate.status,
    'X-VitalCV-Export-Gate-Score': String(gate.survivabilityScore),
    'X-VitalCV-Replay-Attribution': gate.replayAttribution.lineageKey,
  };
}

function blockedExportResponse(gate: ExportGateEvaluation) {
  return NextResponse.json(
    {
      error: 'export_not_ready',
      error_description: gate.summary,
      exportGating: {
        schema: gate.schema,
        status: gate.status,
        readinessStatus: gate.readinessStatus,
        derivedReadinessStatus: gate.derivedReadinessStatus,
        ambiguityLevel: gate.ambiguityLevel,
        survivabilityScore: gate.survivabilityScore,
        blockers: gate.blockers,
        warnings: gate.warnings,
        replayAttribution: gate.replayAttribution,
      },
    },
    {
      status: 409,
      headers: exportGateHeaders(gate),
    },
  );
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return unauthorizedResponse();
  }

  const npi = req.nextUrl.searchParams.get('npi')?.trim() ?? '';
  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'A valid 10-digit NPI is required.',
      },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/passport/npi/${npi}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(await buildIdentityHeaders({ userId })),
      },
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const error = typeof (payload as { error?: unknown } | null)?.error === 'string'
        ? (payload as { error: string }).error
        : 'passport_unavailable';
      const errorDescription = typeof (payload as { detail?: unknown; error_description?: unknown } | null)?.error_description === 'string'
        ? (payload as { error_description: string }).error_description
        : typeof (payload as { detail?: unknown } | null)?.detail === 'string'
          ? (payload as { detail: string }).detail
          : `Passport upstream returned ${upstream.status}.`;

      return NextResponse.json(
        { error, error_description: errorDescription },
        { status: upstream.status },
      );
    }

    const passport = assertPassportData(payload, 'passport payload');
    const exportGate = resolveEmployerPacketExportGate(passport);
    if (!exportGate.allowed) {
      return blockedExportResponse(exportGate);
    }

    const pdf = await renderEmployerProofPacketPdf(passport);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${employerProofPacketFilename(npi)}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
        ...exportGateHeaders(exportGate),
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Packet export failed.';
    const status = detail.startsWith('Invalid passport payload') ? 502 : 500;
    return NextResponse.json(
      {
        error: status === 502 ? 'invalid_upstream_payload' : 'packet_export_failed',
        error_description: detail,
      },
      { status },
    );
  }
}
