import { type NextRequest, NextResponse } from 'next/server';
import { normalizeActionsPayload } from '@/lib/intelligence/contracts';
import { fetchBackendJson, parsePositiveInt } from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 8, 50);
  const entity = req.nextUrl.searchParams.get('entity');
  const priority = req.nextUrl.searchParams.get('priority');
  const actionType = req.nextUrl.searchParams.get('actionType');
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (entity) {
    params.set('entity', entity);
  }

  if (priority) {
    params.set('priority', priority);
  }

  if (actionType) {
    params.set('actionType', actionType);
  }

  try {
    const upstream = await fetchBackendJson<{
      actions?: Array<{
        actionId: string;
        actionType: string;
        priority: string;
        priorityScore: number;
        status: string;
        recommendedAction: string;
        explanation: string;
        confidence: number;
        createdAt: string;
        targetEntity?: {
          entityId?: string;
          entityLabel?: string | null;
        };
        evidence?: Array<{
          label?: string;
          snippet?: string | null;
          source?: string | null;
        }>;
      }>;
      total?: number;
    }>('/api/actions', params);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Actions upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    return NextResponse.json(normalizeActionsPayload(upstream.payload));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load recommended actions',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
