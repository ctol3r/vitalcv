import { type NextRequest, NextResponse } from 'next/server';
import { normalizeStorylinesPayload } from '@/lib/intelligence/contracts';
import { fetchBackendJson, parsePositiveInt } from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 6, 50);
  const provider = req.nextUrl.searchParams.get('provider');
  const severity = req.nextUrl.searchParams.get('severity');
  const status = req.nextUrl.searchParams.get('status');
  const params = new URLSearchParams({
    limit: String(limit),
    sync: 'false',
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
      storylines?: Array<{
        storylineId: string;
        storylineType: string;
        perspective: string;
        title: string;
        summary: string;
        whyItMatters: string;
        severity: string;
        status: string;
        confidence: number;
        entityIds: string[];
        recommendedActions: string[];
        supportingEvidence?: Array<{
          source: string;
          bullet: string;
          observedAt: string;
          confidence: number;
        }>;
        findingIds: string[];
        progressionScore: number;
        lastActivityAt: string;
      }>;
      total?: number;
    }>('/api/storylines', params);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Storyline upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    return NextResponse.json(normalizeStorylinesPayload(upstream.payload));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load storylines',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
