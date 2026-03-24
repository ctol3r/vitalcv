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
import {
  getConnectorDiagnostics,
  getConnectorHealth,
  type ConnectorHealthEntry,
} from '../providers/connectors/connectorHealthTracker';

// ── Types ─────────────────────────────────────────────────────────────

export interface ConnectorTelemetryEntry {
  connector: ConnectorHealthEntry['connector'];
  mode: ConnectorHealthEntry['mode'];
  status: ConnectorHealthEntry['status'];
  requests: number;
  retries: number;
  rateLimitHits: number;
  remainingQuota: number;
  nearQuotaLimit: boolean;
  schemaDriftSeverity: ConnectorHealthEntry['schemaDriftSeverity'];
  schemaBaselineState: ConnectorHealthEntry['schemaBaselineState'];
  quarantined: boolean;
}

export interface ConnectorTelemetrySummary {
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  total: number;
  healthy: number;
  degraded: number;
  unreachable: number;
  quarantined: number;
  blockedByQuota: number;
  nearQuotaLimit: number;
  schemaLearning: number;
  schemaDrifting: number;
  alerts: number;
  totalRequests: number;
  totalRetries: number;
  totalRateLimitHits: number;
  connectors: ConnectorTelemetryEntry[];
}

export interface NetworkTelemetry {
  clinicians: number;
  issuers: number;
  credentials: number;
  decisions: number;
  verificationsToday: number;
  artifactsGenerated: number;
  averageLatency: number;
  trustState: PilotTelemetryDashboard;
  connectors: ConnectorTelemetrySummary;
  generatedAt: string;
}

function buildConnectorTelemetrySummary(): ConnectorTelemetrySummary {
  const health = getConnectorHealth();
  const diagnostics = getConnectorDiagnostics();
  const diagnosticByConnector = new Map(diagnostics.connectors.map((entry) => [entry.connector, entry]));

  const connectors: ConnectorTelemetryEntry[] = health.connectors.map((entry) => ({
    connector: entry.connector,
    mode: entry.mode,
    status: entry.status,
    requests: entry.totalRequests,
    retries: entry.totalRetries,
    rateLimitHits: entry.rateLimitHits,
    remainingQuota: entry.remainingQuota,
    nearQuotaLimit: entry.nearQuotaLimit,
    schemaDriftSeverity: entry.schemaDriftSeverity,
    schemaBaselineState: entry.schemaBaselineState,
    quarantined: entry.quarantined,
  }));

  return {
    overall: diagnostics.overall,
    total: connectors.length,
    healthy: connectors.filter((entry) => entry.status === 'HEALTHY').length,
    degraded: connectors.filter((entry) => entry.status === 'DEGRADED').length,
    unreachable: connectors.filter((entry) => entry.status === 'UNREACHABLE').length,
    quarantined: connectors.filter((entry) => entry.quarantined).length,
    blockedByQuota: diagnostics.connectors.filter((entry) => entry.quota.blockedUntil && Date.parse(entry.quota.blockedUntil) > Date.now()).length,
    nearQuotaLimit: connectors.filter((entry) => entry.nearQuotaLimit).length,
    schemaLearning: connectors.filter((entry) => entry.schemaBaselineState === 'LEARNING').length,
    schemaDrifting: connectors.filter((entry) => entry.schemaDriftSeverity !== 'NONE').length,
    alerts: health.connectors.reduce((sum, entry) => sum + entry.alertCount, 0),
    totalRequests: connectors.reduce((sum, entry) => sum + entry.requests, 0),
    totalRetries: connectors.reduce((sum, entry) => sum + entry.retries, 0),
    totalRateLimitHits: connectors.reduce((sum, entry) => sum + entry.rateLimitHits, 0),
    connectors: connectors.map((entry) => ({
      ...entry,
      nearQuotaLimit: diagnosticByConnector.get(entry.connector)?.quota.nearLimit ?? entry.nearQuotaLimit,
    })),
  };
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
    connectors: buildConnectorTelemetrySummary(),
    generatedAt: new Date().toISOString(),
  };

  log('info', 'telemetry_engine: generated', {
    clinicians: telemetry.clinicians,
    credentials: telemetry.credentials,
    connectorOverall: telemetry.connectors.overall,
  });

  return telemetry;
}
