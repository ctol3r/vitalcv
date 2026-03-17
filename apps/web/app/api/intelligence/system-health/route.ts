import { type NextRequest, NextResponse } from 'next/server';
import { normalizeSystemHealthPayload } from '@/lib/intelligence/contracts';
import {
  buildReadOnlyFallbackPayload,
  fetchBackendJson,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildReadOnlyFallbackPayload('system-health', req, authContext));
  }

  try {
    const [systemStatus, integrity, graphIntegrity] = await Promise.allSettled([
      fetchBackendJson<{
        overall?: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
        uptime?: string;
        verificationHealth?: {
          status?: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
          last24h?: number;
          last1h?: number;
        };
        sourceConnectivity?: Array<{
          source: string;
          status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
          lastSeen: string | null;
          artifactCount: number;
        }>;
        incidents?: Array<{
          id: string;
          severity: 'INFO' | 'WARNING' | 'CRITICAL';
          title: string;
          description: string;
          detectedAt: string;
        }>;
        generatedAt?: string;
      }>('/api/system/status', undefined, 12_000, { context: authContext }),
      fetchBackendJson<{
        status?: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
        checks?: Array<{
          name: string;
          passed: boolean;
          details: string;
          count?: number;
        }>;
        stats?: {
          totalArtifacts: number;
          totalCapsules: number;
          totalEdges: number;
          totalMonitoringStreams: number;
        };
      }>('/api/system/trust-health', undefined, 12_000, { context: authContext }),
      fetchBackendJson<{
        orphanedNodes?: string[];
        invalidEdges?: string[];
        missingCapsuleEdges?: string[];
      }>('/api/system/trust-health/graph', undefined, 12_000, { context: authContext }),
    ]);

    return NextResponse.json(normalizeSystemHealthPayload({
      systemStatus: systemStatus.status === 'fulfilled' && systemStatus.value.ok ? systemStatus.value.payload : null,
      integrity: integrity.status === 'fulfilled' && integrity.value.ok ? integrity.value.payload : null,
      graphIntegrity: graphIntegrity.status === 'fulfilled' && graphIntegrity.value.ok ? graphIntegrity.value.payload : null,
    }));
  } catch {
    return NextResponse.json(buildReadOnlyFallbackPayload('system-health', req, authContext));
  }
}
