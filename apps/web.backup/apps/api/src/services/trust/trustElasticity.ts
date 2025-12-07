import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface TrustElasticityData {
  elasticityCoefficient: number; // 0-1
  shockResponse: {
    sanctions?: number;
    newVCs?: number;
    updates?: number;
  };
  positiveReinforcement: number;
  negativeDampening: number;
  cascadeRisk: number;
  drift: number;
  signals: Array<{
    type: string;
    impact: number;
    timestamp: string;
  }>;
}

/**
 * Task 358.2 — Trust shock-response analyzer
 * Measure how trust responds to sanctions, new VCs, or updates
 */
export async function analyzeTrustShockResponse(
  clinicianId: string,
): Promise<TrustElasticityData['shockResponse']> {
  // Get recent events that could cause trust shocks
  const recentSanctions = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'sanctions',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const recentVCs = await prisma.walletCredential.findMany({
    where: {
      clinicianId,
      revokedAt: null,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Calculate shock response metrics
  const sanctionsImpact = recentSanctions.length > 0 ?
    recentSanctions.reduce((sum, e) => sum + (e.severity || 0), 0) / recentSanctions.length : 0;

  const vcImpact = recentVCs.length > 0 ?
    recentVCs.length * 0.1 : 0; // Positive impact per new VC

  const updates = await prisma.driftEvent.findMany({
    where: {
      clinicianId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    take: 10,
  });

  return {
    sanctions: Math.max(0, Math.min(1, sanctionsImpact)),
    newVCs: Math.max(0, Math.min(1, vcImpact)),
    updates: Math.max(0, Math.min(1, updates.length * 0.05)),
  };
}

/**
 * Task 358.3 — Elasticity scoring engine v4
 * Compute elasticity coefficients 0–1
 */
export async function calculateElasticityScore(
  clinicianId: string,
): Promise<number> {
  const shockResponse = await analyzeTrustShockResponse(clinicianId);

  // Base elasticity from shock response patterns
  const sanctionsElasticity = 1 - shockResponse.sanctions; // Lower trust = lower elasticity
  const vcElasticity = shockResponse.newVCs; // Higher VCs = higher elasticity
  const updateElasticity = 1 - shockResponse.updates * 0.5; // Frequent updates reduce elasticity

  // Weighted average
  const elasticity = (
    sanctionsElasticity * 0.4 +
    vcElasticity * 0.3 +
    updateElasticity * 0.3
  );

  return Math.max(0, Math.min(1, elasticity));
}

/**
 * Task 358.5 — Positive-trust reinforcement engine
 * Reinforce trust after validated events
 */
export async function reinforceTrust(
  clinicianId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const elasticity = await prisma.trustElasticity.findUnique({
    where: { clinicianId },
  });

  const currentData = elasticity?.elasticity as TrustElasticityData | null;
  const reinforcement = currentData?.positiveReinforcement || 0;

  // Positive events increase reinforcement
  let increment = 0;
  if (eventType === 'credential_issued') increment = 0.05;
  if (eventType === 'verification_success') increment = 0.03;
  if (eventType === 'commendation') increment = 0.08;

  const newReinforcement = Math.min(1, reinforcement + increment);

  await prisma.trustElasticity.upsert({
    where: { clinicianId },
    update: {
      elasticity: {
        ...currentData,
        positiveReinforcement: newReinforcement,
      } as TrustElasticityData,
      updatedAt: new Date(),
    },
    create: {
      clinicianId,
      elasticity: {
        elasticityCoefficient: await calculateElasticityScore(clinicianId),
        shockResponse: await analyzeTrustShockResponse(clinicianId),
        positiveReinforcement: newReinforcement,
        negativeDampening: 0,
        cascadeRisk: 0,
        drift: 0,
        signals: [],
      },
      updatedAt: new Date(),
    },
  });

  return newReinforcement;
}

/**
 * Task 358.6 — Negative-trust dampening engine
 * Model trust drop after safety anomalies
 */
export async function dampenTrust(
  clinicianId: string,
  eventType: string,
  severity: number,
): Promise<number> {
  const elasticity = await prisma.trustElasticity.findUnique({
    where: { clinicianId },
  });

  const currentData = elasticity?.elasticity as TrustElasticityData | null;
  const dampening = currentData?.negativeDampening || 0;

  // Negative events increase dampening
  const increment = severity * 0.1;
  const newDampening = Math.min(1, dampening + increment);

  await prisma.trustElasticity.upsert({
    where: { clinicianId },
    update: {
      elasticity: {
        ...currentData,
        negativeDampening: newDampening,
      } as TrustElasticityData,
      updatedAt: new Date(),
    },
    create: {
      clinicianId,
      elasticity: {
        elasticityCoefficient: await calculateElasticityScore(clinicianId),
        shockResponse: await analyzeTrustShockResponse(clinicianId),
        positiveReinforcement: 0,
        negativeDampening: newDampening,
        cascadeRisk: 0,
        drift: 0,
        signals: [],
      },
      updatedAt: new Date(),
    },
  });

  return newDampening;
}

/**
 * Task 358.7 — Cascade risk predictor
 * Predict trust cascades across employers
 */
export async function predictCascadeRisk(
  clinicianId: string,
): Promise<number> {
  // Check how many employers have interacted with this clinician
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId },
    distinct: ['employerId'],
  });

  const employerCount = hiringEvents.length;

  // More employers = higher cascade risk
  const baseRisk = Math.min(1, employerCount * 0.1);

  // Check for recent negative signals
  const recentSignals = await prisma.safetySignal.findMany({
    where: {
      clinicianId,
      reportedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      severity: 'high',
    },
    take: 5,
  });

  const signalRisk = recentSignals.length * 0.2;

  return Math.min(1, baseRisk + signalRisk);
}

/**
 * Task 358.8 — Elasticity drift tracker
 * Track long-term trust elasticity changes
 */
export async function trackElasticityDrift(
  clinicianId: string,
): Promise<number> {
  const elasticity = await prisma.trustElasticity.findUnique({
    where: { clinicianId },
  });

  if (!elasticity) return 0;

  const data = elasticity.elasticity as TrustElasticityData;
  const now = Date.now();
  const updated = elasticity.updatedAt.getTime();
  const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);

  // Drift increases over time
  return Math.min(1, daysSinceUpdate * 0.01);
}

/**
 * Get complete trust elasticity data
 */
export async function getTrustElasticity(
  clinicianId: string,
): Promise<TrustElasticityData> {
  const elasticity = await prisma.trustElasticity.findUnique({
    where: { clinicianId },
  });

  if (elasticity) {
    return elasticity.elasticity as TrustElasticityData;
  }

  // Create initial elasticity record
  const elasticityCoefficient = await calculateElasticityScore(clinicianId);
  const shockResponse = await analyzeTrustShockResponse(clinicianId);
  const cascadeRisk = await predictCascadeRisk(clinicianId);
  const drift = await trackElasticityDrift(clinicianId);

  const data: TrustElasticityData = {
    elasticityCoefficient,
    shockResponse,
    positiveReinforcement: 0,
    negativeDampening: 0,
    cascadeRisk,
    drift,
    signals: [],
  };

  await prisma.trustElasticity.create({
    data: {
      clinicianId,
      elasticity: data,
    },
  });

  return data;
}

/**
 * Task 358.9 — Trust elasticity export pack
 * Generate trust-stability dossier
 */
export async function exportTrustElasticityDossier(
  clinicianId: string,
): Promise<{
  elasticity: TrustElasticityData;
  summary: string;
  recommendations: string[];
}> {
  const elasticity = await getTrustElasticity(clinicianId);

  const recommendations: string[] = [];

  if (elasticity.elasticityCoefficient < 0.5) {
    recommendations.push('Trust elasticity is low - focus on positive reinforcement');
  }
  if (elasticity.cascadeRisk > 0.7) {
    recommendations.push('High cascade risk detected - monitor employer interactions');
  }
  if (elasticity.drift > 0.3) {
    recommendations.push('Significant elasticity drift - review trust factors');
  }

  const summary = `Trust elasticity coefficient: ${elasticity.elasticityCoefficient.toFixed(2)}.
    Cascade risk: ${(elasticity.cascadeRisk * 100).toFixed(1)}%.
    Drift: ${(elasticity.drift * 100).toFixed(1)}%.`;

  return {
    elasticity,
    summary,
    recommendations,
  };
}

/**
 * Task 358.10 — Anchor elasticity snapshot
 */
export async function anchorElasticitySnapshot(
  clinicianId: string,
): Promise<string> {
  const elasticity = await getTrustElasticity(clinicianId);

  const receipt = await chainClient.submitAuditEvent({
    eventType: 'trustElasticityAnchored',
    correlationId: clinicianId,
    tags: ['trust', 'elasticity', 'snapshot'],
    payload: {
      clinicianId,
      elasticity: elasticity.elasticityCoefficient,
      cascadeRisk: elasticity.cascadeRisk,
      drift: elasticity.drift,
      anchoredAt: new Date().toISOString(),
    },
  });

  return receipt.txHash || receipt.eventId;
}

