/**
 * telemetryEngine.ts — Wave 89: Network Telemetry Service
 *
 * Generates aggregate telemetry for the trust network.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  getPilotTelemetryDashboard,
  type PilotTelemetryDashboard,
} from './pilotTelemetry';

// ── Types ─────────────────────────────────────────────────────────────

export interface NetworkTelemetry {
  clinicians: number;
  issuers: number;
  credentials: number;
  decisions: number;
  verificationsToday: number;
  artifactsGenerated: number;
  averageLatency: number;
  trustState: PilotTelemetryDashboard;
  generatedAt: string;
}

// ── Generator ─────────────────────────────────────────────────────────

export async function generateNetworkTelemetry(): Promise<NetworkTelemetry> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const trustStateTelemetry = getPilotTelemetryDashboard();

  const [
    clinicianCount,
    artifactCount,
    decisionCount,
    todayArtifacts,
    issuerSources,
  ] = await Promise.all([
    prisma.provider.count(),
    prisma.verificationArtifact.count(),
    prisma.auditEvent.count({ where: { type: 'DECISION_CAPSULE' } }),
    prisma.verificationArtifact.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.verificationArtifact.groupBy({ by: ['source'], _count: true }),
  ]);

  const telemetry: NetworkTelemetry = {
    clinicians: clinicianCount,
    issuers: issuerSources.length,
    credentials: artifactCount,
    decisions: decisionCount,
    verificationsToday: todayArtifacts,
    artifactsGenerated: artifactCount,
    averageLatency: trustStateTelemetry.metrics.trust_state_latency.avg_ms,
    trustState: trustStateTelemetry,
    generatedAt: new Date().toISOString(),
  };

  log('info', 'telemetry_engine: generated', {
    clinicians: telemetry.clinicians,
    credentials: telemetry.credentials,
  });

  return telemetry;
}
