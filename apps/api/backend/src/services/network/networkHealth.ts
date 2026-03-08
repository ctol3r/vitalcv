/**
 * networkHealth.ts — Wave 162: Network Health Monitoring
 *
 * Gives operators visibility into network stability:
 *   - getNodeHealth()       — per-node health status (issuers + verifiers)
 *   - getIssuerHealth()     — issuer-level health with credential counts + trust scores
 *   - getPayerHealth()      — federated payer/network node health
 *   - getNetworkHealthSummary() — combined dashboard payload
 */

import { log } from '../../obs/logger';
import { listIssuers } from '../registry/trustRegistry';
import { listAllCredentials } from '../credentials/credentialWallet';
import { listRevocations } from '../revocation/revocationRegistry';
import { listFederatedNetworks } from './federation';
import { exportSinceTime } from '../audit/auditLedger';

// ── Types ──────────────────────────────────────────────────────────────────────

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface NodeHealth {
  nodeId: string;
  nodeName: string;
  nodeType: 'issuer' | 'verifier' | 'federation' | 'system';
  status: HealthStatus;
  /** Latency estimate (ms) — approximated from audit event density */
  latencyMs: number | null;
  credentialCount: number;
  activeCredentialCount: number;
  revocationRate: number;
  lastSeenAt: string | null;
  indicators: string[];
}

export interface IssuerHealth {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  trustScore: number;
  status: HealthStatus;
  credentialsIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  revocationRatePct: number;
  lastActivityAt: string | null;
  indicators: string[];
}

export interface PayerHealth {
  networkId: string;
  networkName: string;
  networkType: string;
  connectionStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISCONNECTED';
  healthStatus: HealthStatus;
  providerCount: number;
  lastSyncAt: string | null;
  indicators: string[];
}

export interface NetworkHealthSummary {
  overallStatus: HealthStatus;
  nodes: NodeHealth[];
  issuers: IssuerHealth[];
  payers: PayerHealth[];
  stats: {
    totalNodes: number;
    healthyNodes: number;
    degradedNodes: number;
    criticalNodes: number;
    totalIssuers: number;
    healthyIssuers: number;
    federatedNetworks: number;
    activeNetworks: number;
  };
  computedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveHealthStatus(revocationRatePct: number, hasRecentActivity: boolean, trustScore = 100): HealthStatus {
  if (revocationRatePct > 30 || trustScore < 30) return 'CRITICAL';
  if (revocationRatePct > 15 || trustScore < 60 || !hasRecentActivity) return 'DEGRADED';
  return 'HEALTHY';
}

function connectionStatusToHealth(status: string): HealthStatus {
  switch (status) {
    case 'ACTIVE':       return 'HEALTHY';
    case 'PENDING':      return 'DEGRADED';
    case 'SUSPENDED':    return 'DEGRADED';
    case 'DISCONNECTED': return 'CRITICAL';
    default:             return 'UNKNOWN';
  }
}

function rollupStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('CRITICAL')) return 'CRITICAL';
  if (statuses.includes('DEGRADED')) return 'DEGRADED';
  if (statuses.every((s) => s === 'HEALTHY')) return 'HEALTHY';
  return 'UNKNOWN';
}

function latencyFromAuditDensity(events: number, windowHours: number): number {
  // Rough heuristic: more events → lower estimated latency
  const eventsPerHour = windowHours > 0 ? events / windowHours : 0;
  if (eventsPerHour > 100) return 45;
  if (eventsPerHour > 10)  return 120;
  if (eventsPerHour > 1)   return 350;
  return 800;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get per-node health status across issuers + federation nodes.
 */
export function getNodeHealth(): NodeHealth[] {
  const issuers = listIssuers();
  const credentials = listAllCredentials();
  const revocations = listRevocations();

  const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentEvents = exportSinceTime(sinceDate);

  const nodes: NodeHealth[] = [];

  // Issuer nodes
  for (const issuer of issuers) {
    const issuerCreds = credentials.filter((c) => c.issuer === issuer.issuerId);
    const activeCreds = issuerCreds.filter((c) => c.status === 'ACTIVE');
    const revokedCreds = revocations.filter((r) =>
      issuerCreds.some((c) => c.credentialId === r.credentialId),
    );
    const revocationRate = issuerCreds.length > 0
      ? Math.round((revokedCreds.length / issuerCreds.length) * 100)
      : 0;

    const lastSeen = issuerCreds.length > 0
      ? issuerCreds.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0].issuedAt
      : null;

    const hasRecentActivity = lastSeen
      ? Date.now() - new Date(lastSeen).getTime() < 7 * 24 * 60 * 60 * 1000
      : false;

    const status = deriveHealthStatus(revocationRate, hasRecentActivity, issuer.trustScore ?? 50);

    const indicators: string[] = [];
    if (revocationRate > 15) indicators.push(`High revocation rate: ${revocationRate}%`);
    if (!hasRecentActivity && issuerCreds.length > 0) indicators.push('No recent credential activity');
    if ((issuer.trustScore ?? 50) < 60) indicators.push(`Low trust score: ${issuer.trustScore}`);
    if (indicators.length === 0) indicators.push('All systems nominal');

    nodes.push({
      nodeId: issuer.issuerId,
      nodeName: issuer.issuerName,
      nodeType: 'issuer',
      status,
      latencyMs: latencyFromAuditDensity(recentEvents.length, 24),
      credentialCount: issuerCreds.length,
      activeCredentialCount: activeCreds.length,
      revocationRate,
      lastSeenAt: lastSeen,
      indicators,
    });
  }

  // System node (self)
  nodes.push({
    nodeId: 'vitalcv-core',
    nodeName: 'VitalCV Core',
    nodeType: 'system',
    status: 'HEALTHY',
    latencyMs: latencyFromAuditDensity(recentEvents.length, 24),
    credentialCount: credentials.length,
    activeCredentialCount: credentials.filter((c) => c.status === 'ACTIVE').length,
    revocationRate: credentials.length > 0
      ? Math.round((revocations.length / credentials.length) * 100)
      : 0,
    lastSeenAt: new Date().toISOString(),
    indicators: ['Core node operational'],
  });

  log('info', 'network_node_health_computed', { nodeCount: nodes.length });
  return nodes;
}

/**
 * Get per-issuer health with credential stats and trust score.
 */
export function getIssuerHealth(): IssuerHealth[] {
  const issuers = listIssuers();
  const credentials = listAllCredentials();
  const revocations = listRevocations();

  return issuers.map((issuer): IssuerHealth => {
    const issuerCreds = credentials.filter((c) => c.issuer === issuer.issuerId);
    const activeCreds = issuerCreds.filter((c) => c.status === 'ACTIVE');
    const revokedCreds = revocations.filter((r) =>
      issuerCreds.some((c) => c.credentialId === r.credentialId),
    );
    const revocationRatePct = issuerCreds.length > 0
      ? Math.round((revokedCreds.length / issuerCreds.length) * 100)
      : 0;

    const lastActivity = issuerCreds.length > 0
      ? issuerCreds.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0].issuedAt
      : null;

    const hasRecentActivity = lastActivity
      ? Date.now() - new Date(lastActivity).getTime() < 7 * 24 * 60 * 60 * 1000
      : false;

    const trustScore = issuer.trustScore ?? 50;
    const status = deriveHealthStatus(revocationRatePct, hasRecentActivity, trustScore);

    const indicators: string[] = [];
    if (revokedCreds.length > 0) indicators.push(`${revokedCreds.length} credential(s) revoked`);
    if (revocationRatePct > 15) indicators.push(`Revocation rate elevated: ${revocationRatePct}%`);
    if (trustScore < 60) indicators.push(`Trust score below threshold: ${trustScore}`);
    if (!hasRecentActivity) indicators.push('No activity in last 7 days');
    if (indicators.length === 0) indicators.push('Issuer in good standing');

    return {
      issuerId: issuer.issuerId,
      issuerName: issuer.issuerName,
      trustLevel: issuer.trustLevel,
      trustScore,
      status,
      credentialsIssued: issuerCreds.length,
      activeCredentials: activeCreds.length,
      revokedCredentials: revokedCreds.length,
      revocationRatePct,
      lastActivityAt: lastActivity,
      indicators,
    };
  });
}

/**
 * Get federated payer/network health.
 */
export function getPayerHealth(): PayerHealth[] {
  const networks = listFederatedNetworks();

  return networks.map((network): PayerHealth => {
    const healthStatus = connectionStatusToHealth(network.status);

    const indicators: string[] = [];
    if (network.status === 'SUSPENDED')    indicators.push('Network suspended — contact federation admin');
    if (network.status === 'DISCONNECTED') indicators.push('Connection lost — federation offline');
    if (network.status === 'PENDING')      indicators.push('Awaiting federation handshake');
    if (indicators.length === 0)           indicators.push('Federation link active');

    return {
      networkId: network.networkId,
      networkName: network.networkName,
      networkType: network.networkType,
      connectionStatus: network.status,
      healthStatus,
      providerCount: network.nodeCount ?? 0,
      lastSyncAt: network.lastSyncAt ?? network.registeredAt ?? null,
      indicators,
    };
  });
}

/**
 * Combined dashboard payload for GET /api/network/health.
 */
export function getNetworkHealthSummary(): NetworkHealthSummary {
  const nodes = getNodeHealth();
  const issuers = getIssuerHealth();
  const payers = getPayerHealth();

  const nodeStatuses = nodes.map((n) => n.status);
  const issuerStatuses = issuers.map((i) => i.status);
  const payerStatuses = payers.map((p) => p.healthStatus);
  const overallStatus = rollupStatus([...nodeStatuses, ...issuerStatuses, ...payerStatuses]);

  const stats = {
    totalNodes: nodes.length,
    healthyNodes: nodes.filter((n) => n.status === 'HEALTHY').length,
    degradedNodes: nodes.filter((n) => n.status === 'DEGRADED').length,
    criticalNodes: nodes.filter((n) => n.status === 'CRITICAL').length,
    totalIssuers: issuers.length,
    healthyIssuers: issuers.filter((i) => i.status === 'HEALTHY').length,
    federatedNetworks: payers.length,
    activeNetworks: payers.filter((p) => p.connectionStatus === 'ACTIVE').length,
  };

  log('info', 'network_health_summary_computed', {
    overallStatus,
    totalNodes: stats.totalNodes,
    totalIssuers: stats.totalIssuers,
    federatedNetworks: stats.federatedNetworks,
  });

  return {
    overallStatus,
    nodes,
    issuers,
    payers,
    stats,
    computedAt: new Date().toISOString(),
  };
}
