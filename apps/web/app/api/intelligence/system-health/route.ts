import { NextResponse } from 'next/server';
import { normalizeSystemHealthPayload } from '@/lib/intelligence/contracts';
import { fetchBackendJson } from '../_shared';

export const runtime = 'nodejs';

export async function GET() {
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
      }>('/api/system/status'),
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
      }>('/api/system/trust-health'),
      fetchBackendJson<{
        orphanedNodes?: string[];
        invalidEdges?: string[];
        missingCapsuleEdges?: string[];
      }>('/api/system/trust-health/graph'),
    ]);

    return NextResponse.json(normalizeSystemHealthPayload({
      systemStatus: systemStatus.status === 'fulfilled' && systemStatus.value.ok ? systemStatus.value.payload : null,
      integrity: integrity.status === 'fulfilled' && integrity.value.ok ? integrity.value.payload : null,
      graphIntegrity: graphIntegrity.status === 'fulfilled' && graphIntegrity.value.ok ? graphIntegrity.value.payload : null,
    }));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load intelligence system health',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
