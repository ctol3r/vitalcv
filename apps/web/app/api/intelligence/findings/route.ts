import { type NextRequest, NextResponse } from 'next/server';
import { normalizeFindingsPayload } from '@/lib/intelligence/contracts';
import { fetchBackendJson, parsePositiveInt } from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 8, 50);
  const provider = req.nextUrl.searchParams.get('provider');
  const severity = req.nextUrl.searchParams.get('severity');
  const status = req.nextUrl.searchParams.get('status');
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (provider) {
    params.set('provider', provider);
  }

  if (severity) {
    params.set('severity', severity);
  }

  if (status) {
    params.set('status', status);
  }

  try {
    const upstream = await fetchBackendJson<{
      findings?: Array<{
        findingId: string;
        investigatorId: string;
        findingType: string;
        severity: string;
        status: string;
        title: string;
        summary: string;
        explanation: string;
        entityIds?: string[];
        metadata?: Record<string, unknown>;
        priorityScore: number;
        confidence: number;
        storylineKey: string | null;
        supportingEvidence?: Array<{
          evidenceId?: string;
          evidenceType?: string;
          snippet?: string | null;
          sourceLabel?: string | null;
          sourceId?: string | null;
          observedAt?: string | null;
        }>;
        updatedAt: string;
      }>;
      total?: number;
    }>('/api/investigators/findings', params);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Investigator upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    return NextResponse.json(normalizeFindingsPayload(upstream.payload));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load findings feed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
