/**
 * useSystemStatus.ts — Wave 93
 *
 * Polls GET /api/system/status every 30s.
 * Returns live infrastructure health data for SystemConsole + StatusPage.
 */

'use client';

import { useApi } from './useApi';

export type HealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';

export interface SystemStatus {
  overall: HealthStatus;
  uptime: string;
  verificationHealth: {
    status: HealthStatus;
    last24h: number;
    last1h: number;
  };
  latency: {
    average: number;
    p95: number;
  };
  artifactIntegrity: {
    total: number;
    verified: number;
    revoked: number;
    expired: number;
  };
  sourceConnectivity: Array<{
    source: string;
    status: HealthStatus;
    lastSeen: string | null;
    artifactCount: number;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    description: string;
    detectedAt: string;
    resolvedAt: string | null;
  }>;
  generatedAt: string;
}

export function useSystemStatus(intervalMs = 30_000) {
  return useApi<SystemStatus>('/api/system/status', { interval: intervalMs });
}
