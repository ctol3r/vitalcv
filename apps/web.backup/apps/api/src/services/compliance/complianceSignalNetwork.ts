import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface ComplianceSignal {
  signalId: string;
  entityType: 'clinician' | 'employer' | 'credential' | 'regulator' | 'agent';
  entityId: string;
  signalType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ComplianceSignalNetworkData {
  signals: ComplianceSignal[];
  propagationGraph: Array<{
    from: string;
    to: string;
    weight: number;
  }>;
  clusters: Array<{
    clusterId: string;
    signals: string[];
    riskLevel: string;
  }>;
  updatedAt: string;
}

/**
 * Task 277.2 — Compliance-signal ingestion v4
 * Ingest signals from regulatory checks, PSV, ATS events
 */
export async function ingestComplianceSignal(
  signal: Omit<ComplianceSignal, 'signalId' | 'timestamp'>,
): Promise<string> {
  const network = await getOrCreateNetwork();

  const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const fullSignal: ComplianceSignal = {
    ...signal,
    signalId,
    timestamp: new Date().toISOString(),
  };

  network.signals.push(fullSignal);

  // Trigger propagation
  await propagateSignal(fullSignal, network);

  await saveNetwork(network);

  return signalId;
}

/**
 * Task 277.3 — Cross-entity compliance propagation
 * Propagation: clinician → employer → regulator nodes
 */
async function propagateSignal(
  signal: ComplianceSignal,
  network: ComplianceSignalNetworkData,
): Promise<void> {
  // Find related entities
  if (signal.entityType === 'clinician') {
    // Propagate to employers
    const hiringEvents = await prisma.hiringEvent.findMany({
      where: { clinicianId: signal.entityId },
      take: 5,
    });

    for (const event of hiringEvents) {
      const employerSignal: ComplianceSignal = {
        signalId: `prop_${signal.signalId}_${event.employerId}`,
        entityType: 'employer',
        entityId: event.employerId,
        signalType: 'propagated_risk',
        severity: signal.severity === 'critical' ? 'high' : signal.severity,
        source: 'propagation',
        timestamp: new Date().toISOString(),
        metadata: {
          sourceSignal: signal.signalId,
          sourceEntity: signal.entityId,
        },
      };

      network.signals.push(employerSignal);

      // Add to propagation graph
      network.propagationGraph.push({
        from: signal.signalId,
        to: employerSignal.signalId,
        weight: 0.8,
      });
    }
  }
}

/**
 * Task 277.4 — Compliance risk interpreter
 * Explain compliance risk in plain language
 */
export async function interpretComplianceRisk(
  signalId: string,
): Promise<{ explanation: string; recommendations: string[]; severity: string }> {
  const network = await getOrCreateNetwork();
  const signal = network.signals.find((s) => s.signalId === signalId);

  if (!signal) {
    return {
      explanation: 'Signal not found',
      recommendations: [],
      severity: 'low',
    };
  }

  let explanation = '';
  const recommendations: string[] = [];

  switch (signal.signalType) {
    case 'license_expired':
      explanation = `License for ${signal.entityId} has expired. This prevents legal practice.`;
      recommendations.push('Renew license immediately');
      recommendations.push('Suspend practice until renewal');
      break;
    case 'sanction_detected':
      explanation = `Sanction detected for ${signal.entityId}. This may restrict practice.`;
      recommendations.push('Review sanction details');
      recommendations.push('Contact regulatory board');
      break;
    case 'credential_mismatch':
      explanation = `Credential information mismatch detected for ${signal.entityId}.`;
      recommendations.push('Verify credential details');
      recommendations.push('Update credential records');
      break;
    default:
      explanation = `Compliance issue detected: ${signal.signalType}`;
      recommendations.push('Review signal details');
  }

  return {
    explanation,
    recommendations,
    severity: signal.severity,
  };
}

/**
 * Task 277.6 — Agent-level compliance monitoring
 * Monitor AI agent behavior vs compliance rules
 */
export async function monitorAgentCompliance(
  agentId: string,
  action: string,
  context: Record<string, unknown>,
): Promise<{ compliant: boolean; violations: string[] }> {
  const violations: string[] = [];

  // Check for PHI exposure
  if (action.includes('phi') || context.phiExposed) {
    violations.push('Potential PHI exposure detected');
  }

  // Check for bias
  if (action.includes('match') && context.biasScore && context.biasScore > 0.3) {
    violations.push('Potential bias in matching decision');
  }

  // Check for unauthorized access
  if (action.includes('access') && !context.authorized) {
    violations.push('Unauthorized access attempt');
  }

  if (violations.length > 0) {
    await ingestComplianceSignal({
      entityType: 'agent',
      entityId: agentId,
      signalType: 'agent_violation',
      severity: violations.length > 1 ? 'high' : 'medium',
      source: 'agent_monitor',
      metadata: {
        action,
        violations,
        context,
      },
    });
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * Task 277.7 — Compliance-signal clustering
 * Identify clusters of similar risk patterns
 */
export async function clusterComplianceSignals(): Promise<
  Array<{ clusterId: string; signals: string[]; riskLevel: string; pattern: string }>
> {
  const network = await getOrCreateNetwork();

  const clusters: Array<{
    clusterId: string;
    signals: string[];
    riskLevel: string;
    pattern: string;
  }> = [];

  // Group by signal type and entity
  const grouped = new Map<string, ComplianceSignal[]>();

  for (const signal of network.signals) {
    const key = `${signal.signalType}_${signal.entityType}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(signal);
  }

  for (const [key, signals] of grouped.entries()) {
    if (signals.length >= 3) {
      const severityCounts = {
        critical: signals.filter((s) => s.severity === 'critical').length,
        high: signals.filter((s) => s.severity === 'high').length,
        medium: signals.filter((s) => s.severity === 'medium').length,
      };

      const riskLevel =
        severityCounts.critical > 0
          ? 'critical'
          : severityCounts.high > 0
            ? 'high'
            : 'medium';

      clusters.push({
        clusterId: `cluster_${clusters.length + 1}`,
        signals: signals.map((s) => s.signalId),
        riskLevel,
        pattern: key,
      });
    }
  }

  network.clusters = clusters;
  await saveNetwork(network);

  return clusters;
}

/**
 * Task 277.8 — Compliance anomaly watcher
 * Flag unusual events
 */
export async function watchForAnomalies(): Promise<
  Array<{ signalId: string; anomalyType: string; description: string; severity: string }>
> {
  const network = await getOrCreateNetwork();
  const anomalies: Array<{
    signalId: string;
    anomalyType: string;
    description: string;
    severity: string;
  }> = [];

  // Check for sudden spike in signals
  const recentSignals = network.signals.filter(
    (s) => new Date(s.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000,
  );

  if (recentSignals.length > 50) {
    anomalies.push({
      signalId: 'spike_detection',
      anomalyType: 'signal_spike',
      description: `Unusual spike: ${recentSignals.length} signals in last 24 hours`,
      severity: 'high',
    });
  }

  // Check for critical signals
  const criticalSignals = network.signals.filter((s) => s.severity === 'critical');
  if (criticalSignals.length > 0) {
    for (const signal of criticalSignals.slice(-5)) {
      anomalies.push({
        signalId: signal.signalId,
        anomalyType: 'critical_signal',
        description: `Critical compliance issue: ${signal.signalType}`,
        severity: 'critical',
      });
    }
  }

  return anomalies;
}

/**
 * Task 277.9 — Compliance correction routing
 * Auto-route required fix steps to user
 */
export async function routeComplianceCorrection(
  signalId: string,
  userId: string,
): Promise<{ correctionId: string; steps: Array<{ action: string; priority: string }> }> {
  const interpretation = await interpretComplianceRisk(signalId);

  const steps = interpretation.recommendations.map((rec, idx) => ({
    action: rec,
    priority: idx === 0 ? 'high' : 'medium',
  }));

  // Create correction record (simplified - would create actual correction workflow)
  const correctionId = `correction_${Date.now()}`;

  return {
    correctionId,
    steps,
  };
}

/**
 * Get or create compliance signal network
 */
async function getOrCreateNetwork(): Promise<ComplianceSignalNetworkData> {
  let networkRecord = await prisma.complianceSignalNetwork.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!networkRecord) {
    networkRecord = await prisma.complianceSignalNetwork.create({
      data: {
        signals: {
          signals: [],
          propagationGraph: [],
          clusters: [],
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  return networkRecord.signals as ComplianceSignalNetworkData;
}

async function saveNetwork(network: ComplianceSignalNetworkData): Promise<void> {
  const existing = await prisma.complianceSignalNetwork.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    await prisma.complianceSignalNetwork.update({
      where: { id: existing.id },
      data: {
        signals: network as any,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.complianceSignalNetwork.create({
      data: {
        signals: network as any,
      },
    });
  }
}

/**
 * Task 277.10 — Anchor compliance signal snapshot
 */
export async function anchorComplianceSignalSnapshot(): Promise<string | null> {
  try {
    const network = await getOrCreateNetwork();

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'complianceSignalAnchored',
      payload: {
        signalCount: network.signals.length,
        clusterCount: network.clusters.length,
        criticalSignals: network.signals.filter((s) => s.severity === 'critical').length,
        updatedAt: network.updatedAt,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[ComplianceSignalNetwork] Failed to anchor snapshot', error);
    return null;
  }
}

