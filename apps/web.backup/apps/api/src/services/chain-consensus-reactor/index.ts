/**
 * Batch 435 — Chain Integrity Consensus Reactor v7
 * A consensus reactor that continuously evaluates chain integrity & feeds trust decisions
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface IntegritySignal {
  type: 'validator_drift' | 'block_time_variance' | 'anchor_gap' | 'finality_instability';
  value: number;
  network: string;
  timestamp: string;
}

export interface ChainConsensusResult {
  reactor: {
    integrityScore: number; // 0-100
    signals: IntegritySignal[];
    health: 'healthy' | 'degraded' | 'critical';
    networks: Array<{
      network: string;
      integrity: number;
      status: string;
    }>;
  };
  trust: {
    weights: Record<string, number>; // network -> trust weight
    recalibrated: boolean;
    adjustments: Array<{
      network: string;
      oldWeight: number;
      newWeight: number;
      reason: string;
    }>;
  };
  quorum: {
    required: number; // minimum chains needed
    verified: number; // currently verified across chains
    satisfied: boolean;
  };
  decay: {
    predicted: boolean;
    forecastDate: string | null;
    degradationRate: number;
    factors: string[];
  };
  escalation: {
    triggered: boolean;
    fallbackRoutes: string[];
    reason: string | null;
  };
  updatedAt: string;
}

/**
 * Gather chain-integrity signals
 */
function collectIntegritySignals(signals: IntegritySignal[]): Record<string, IntegritySignal[]> {
  return signals.reduce((acc, signal) => {
    if (!acc[signal.type]) acc[signal.type] = [];
    acc[signal.type].push(signal);
    return acc;
  }, {} as Record<string, IntegritySignal[]>);
}

/**
 * Evaluate chain consensus
 */
function evaluateConsensus(signals: IntegritySignal[]): ChainConsensusResult['reactor'] {
  const byNetwork = signals.reduce((acc, signal) => {
    if (!acc[signal.network]) acc[signal.network] = [];
    acc[signal.network].push(signal);
    return acc;
  }, {} as Record<string, IntegritySignal[]>);

  const networks = Object.entries(byNetwork).map(([network, netSignals]) => {
    const avgValue = netSignals.reduce((sum, s) => sum + s.value, 0) / netSignals.length;
    const integrity = Math.max(0, 100 - avgValue); // Invert: higher signal = lower integrity

    return {
      network,
      integrity: Math.round(integrity),
      status: integrity > 80 ? 'healthy' : integrity > 50 ? 'degraded' : 'critical',
    };
  });

  const overallIntegrity = networks.reduce((sum, net) => sum + net.integrity, 0) / networks.length;

  const health: 'healthy' | 'degraded' | 'critical' =
    overallIntegrity > 80 ? 'healthy' :
    overallIntegrity > 50 ? 'degraded' : 'critical';

  return {
    integrityScore: Math.round(overallIntegrity),
    signals,
    health,
    networks,
  };
}

/**
 * Adjust trust weights based on chain health
 */
function recalibrateTrust(
  reactor: ChainConsensusResult['reactor']
): ChainConsensusResult['trust'] {
  const weights: Record<string, number> = {};
  const adjustments: ChainConsensusResult['trust']['adjustments'] = [];

  // Start with equal weights
  const baseWeight = 1.0 / reactor.networks.length;

  reactor.networks.forEach((network) => {
    const oldWeight = baseWeight;
    // Adjust weight based on integrity (higher integrity = higher weight)
    const newWeight = baseWeight * (network.integrity / 100);

    weights[network.network] = newWeight;

    if (Math.abs(newWeight - oldWeight) > 0.1) {
      adjustments.push({
        network: network.network,
        oldWeight,
        newWeight,
        reason: `Integrity score: ${network.integrity}`,
      });
    }
  });

  // Normalize weights
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  Object.keys(weights).forEach((network) => {
    weights[network] = weights[network] / totalWeight;
  });

  return {
    weights,
    recalibrated: adjustments.length > 0,
    adjustments,
  };
}

/**
 * Require proofs verified across >1 chain
 */
function verifyMultiChainQuorum(
  networks: Array<{ network: string; integrity: number; status: string }>
): ChainConsensusResult['quorum'] {
  const healthyNetworks = networks.filter((net) => net.status === 'healthy');
  const required = Math.min(2, networks.length); // At least 2 chains
  const verified = healthyNetworks.length;

  return {
    required,
    verified,
    satisfied: verified >= required,
  };
}

/**
 * Forecast chain integrity degradation
 */
function forecastDecay(
  reactor: ChainConsensusResult['reactor']
): ChainConsensusResult['decay'] {
  const recentSignals = reactor.signals
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  if (recentSignals.length < 2) {
    return {
      predicted: false,
      forecastDate: null,
      degradationRate: 0,
      factors: [],
    };
  }

  const olderSignals = recentSignals.slice(10);
  const newerSignals = recentSignals.slice(0, 10);

  const olderAvg = olderSignals.reduce((sum, s) => sum + s.value, 0) / olderSignals.length;
  const newerAvg = newerSignals.reduce((sum, s) => sum + s.value, 0) / newerSignals.length;

  const degradationRate = (newerAvg - olderAvg) / olderAvg * 100; // Percentage change

  return {
    predicted: degradationRate > 10,
    forecastDate: degradationRate > 10 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    degradationRate: Math.round(degradationRate * 10) / 10,
    factors: degradationRate > 10 ? ['Increasing validator drift', 'Block time variance'] : [],
  };
}

/**
 * Escalate to fallback chain routes
 */
function handleEscalation(
  reactor: ChainConsensusResult['reactor'],
  quorum: ChainConsensusResult['quorum']
): ChainConsensusResult['escalation'] {
  const triggered = !quorum.satisfied || reactor.health === 'critical';
  const fallbackRoutes: string[] = [];
  let reason: string | null = null;

  if (triggered) {
    // Find alternative networks
    const alternativeNetworks = reactor.networks.filter((net) => net.status !== 'critical');
    fallbackRoutes.push(...alternativeNetworks.map((net) => net.network));

    reason = quorum.satisfied
      ? `Chain health critical: ${reactor.health}`
      : `Quorum not satisfied: ${quorum.verified}/${quorum.required} networks healthy`;
  }

  return {
    triggered,
    fallbackRoutes,
    reason,
  };
}

/**
 * Generate consensus reactor profile
 */
export async function generateConsensusReactor(signals: IntegritySignal[]): Promise<ChainConsensusResult> {
  const reactor = evaluateConsensus(signals);
  const trust = recalibrateTrust(reactor);
  const quorum = verifyMultiChainQuorum(reactor.networks);
  const decay = forecastDecay(reactor);
  const escalation = handleEscalation(reactor, quorum);

  const result: ChainConsensusResult = {
    reactor,
    trust,
    quorum,
    decay,
    escalation,
    updatedAt: new Date().toISOString(),
  };

  // Save to database (only one reactor exists)
  await prisma.chainConsensusReactor.upsert({
    where: { id: 'current' },
    create: {
      id: 'current',
      reactor: result as any,
    },
    update: {
      reactor: result as any,
    },
  });

  return result;
}

/**
 * Export consensus pack
 */
export async function exportConsensusPack(): Promise<{
  consensus: ChainConsensusResult;
  exportHash: string;
  generatedAt: string;
}> {
  const record = await prisma.chainConsensusReactor.findUnique({
    where: { id: 'current' },
  });

  if (!record) {
    throw new Error('No consensus reactor found');
  }

  const consensus = record.reactor as any as ChainConsensusResult;

  // Anchor snapshot
  anchorEvent('chainConsensusAnchored', {
    consensusHash: createHash('sha256').update(JSON.stringify(consensus)).digest('hex'),
    integrityScore: consensus.reactor.integrityScore,
    quorumSatisfied: consensus.quorum.satisfied,
    health: consensus.reactor.health,
  });

  return {
    consensus,
    exportHash: `consensus_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}








