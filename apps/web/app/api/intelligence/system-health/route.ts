import { type NextRequest, NextResponse } from 'next/server';
import { normalizeCanonicalSystemHealthPayload } from '@/lib/intelligence/contracts';
import {
  attachAccessMetadata,
  coerceRouteErrorPayload,
  fetchBackendJson,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();

  try {
    const upstream = await fetchBackendJson<{
      status?: 'HEALTHY' | 'WARMING' | string;
      providers?: number;
      findings?: number;
      storylines?: number;
      systemState?: string | null;
      lastEventAt?: string | null;
      generatedAt?: string;
      agents?: Array<{
        id: string;
        name: string;
        enabled: boolean;
        lastRun: string | null;
        lastIssueCount: number;
      }>;
      totalIssues?: number;
      totalAutoRepaired?: number;
      totalSurfaced?: number;
    }>('/api/system-health', undefined, 12_000, { context: authContext });

    if (!upstream.ok) {
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `System health backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 503 },
      );
    }

    return NextResponse.json(attachAccessMetadata(
      normalizeCanonicalSystemHealthPayload(upstream.payload),
      {
        accessMode: 'full',
        reason: 'ok',
      },
    ));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: error instanceof Error ? error.message : 'System health request failed.',
      },
      { status: 503 },
    );
  }
}
