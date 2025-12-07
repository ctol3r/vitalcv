import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReputationLayer {
  credentialReliability: {
    score: number;
    accuracy: number;
    verificationHistory: Array<{ date: string; accuracy: number }>;
  };
  complianceDiscipline: {
    score: number;
    cmePattern: { completed: number; required: number; compliance: number };
    renewalBehavior: { onTime: number; late: number; missed: number };
    documentAccuracy: number;
  };
  professionalismInteraction: {
    score: number;
    communicationQuality: number;
    responseTime: number;
    employerFeedback: Array<{ orgId: string; rating: number; comment?: string }>;
  };
  futureRiskPrediction: {
    score: number;
    probability: number;
    factors: Array<{ factor: string; weight: number; impact: string }>;
  };
}

/**
 * Track verification accuracy across time
 */
export async function buildCredentialReliabilityLayer(clinicianId: string): Promise<ReputationLayer['credentialReliability']> {
  // Get credential verification history
  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId, revokedAt: null },
  });

  const verifications = await prisma.complianceCheck.findMany({
    where: { clinicianId, type: 'verification' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const history = verifications.map((v) => ({
    date: v.createdAt.toISOString(),
    accuracy: (v.result as any).accuracy ?? 0.95,
  }));

  const avgAccuracy = history.length > 0
    ? history.reduce((sum, h) => sum + h.accuracy, 0) / history.length
    : 0.95;

  return {
    score: avgAccuracy,
    accuracy: avgAccuracy,
    verificationHistory: history,
  };
}

/**
 * Track CME patterning, renewal behavior, document accuracy
 */
export async function buildComplianceDisciplineLayer(clinicianId: string): Promise<ReputationLayer['complianceDiscipline']> {
  // CME tracking (mock - would integrate with CME system)
  const cmeCompleted = 45; // Mock
  const cmeRequired = 50;
  const cmeCompliance = cmeCompleted / cmeRequired;

  // Renewal behavior
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  let onTime = 0;
  let late = 0;
  let missed = 0;

  for (const license of licenses) {
    if (license.expiresAt) {
      const daysBeforeExpiry = (license.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      if (daysBeforeExpiry > 30) {
        onTime++;
      } else if (daysBeforeExpiry > 0) {
        late++;
      } else {
        missed++;
      }
    }
  }

  // Document accuracy (from compliance checks)
  const docChecks = await prisma.complianceCheck.findMany({
    where: { clinicianId, type: 'document' },
    take: 50,
  });

  const docAccuracy = docChecks.length > 0
    ? docChecks.filter((c) => (c.result as any).accurate === true).length / docChecks.length
    : 0.95;

  return {
    score: (cmeCompliance * 0.4 + (onTime / (onTime + late + missed || 1)) * 0.4 + docAccuracy * 0.2),
    cmePattern: { completed: cmeCompleted, required: cmeRequired, compliance: cmeCompliance },
    renewalBehavior: { onTime, late, missed },
    documentAccuracy: docAccuracy,
  };
}

/**
 * Analyze communication patterns with employers/issuers
 */
export async function buildProfessionalismInteractionLayer(clinicianId: string): Promise<ReputationLayer['professionalismInteraction']> {
  // Get employer feedback (from hiring events or feedback system)
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId },
    take: 50,
  });

  const employerFeedback: Array<{ orgId: string; rating: number; comment?: string }> = [];
  const orgRatings = new Map<string, number[]>();

  for (const event of hiringEvents) {
    const metadata = event.metadata as any;
    if (metadata?.rating) {
      if (!orgRatings.has(event.employerId)) {
        orgRatings.set(event.employerId, []);
      }
      orgRatings.get(event.employerId)!.push(metadata.rating);
    }
  }

  for (const [orgId, ratings] of orgRatings.entries()) {
    const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    employerFeedback.push({
      orgId,
      rating: avgRating,
    });
  }

  // Mock communication quality and response time
  const communicationQuality = employerFeedback.length > 0
    ? employerFeedback.reduce((sum, f) => sum + f.rating, 0) / employerFeedback.length / 5.0
    : 0.8;

  const responseTime = 0.85; // Mock - would track actual response times

  return {
    score: (communicationQuality * 0.6 + responseTime * 0.4),
    communicationQuality,
    responseTime,
    employerFeedback,
  };
}

/**
 * Predict probability of future sanctions
 */
export async function buildFutureRiskPredictionLayer(clinicianId: string): Promise<ReputationLayer['futureRiskPrediction']> {
  // Get historical risk events
  const riskEvents = await prisma.riskEvent.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const factors: Array<{ factor: string; weight: number; impact: string }> = [];

  // Historical sanctions
  const sanctions = riskEvents.filter((e) => e.type === 'sanctions');
  if (sanctions.length > 0) {
    factors.push({
      factor: 'Historical sanctions',
      weight: Math.min(sanctions.length * 0.1, 0.5),
      impact: 'high',
    });
  }

  // Recent risk events
  const recentEvents = riskEvents.filter(
    (e) => e.createdAt.getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000
  );
  if (recentEvents.length > 3) {
    factors.push({
      factor: 'Recent risk events',
      weight: Math.min(recentEvents.length * 0.05, 0.3),
      impact: 'medium',
    });
  }

  // Compliance issues
  const complianceIssues = await prisma.complianceCheck.findMany({
    where: {
      clinicianId,
      type: { in: ['license', 'board', 'dea'] },
    },
    take: 50,
  });

  const failedChecks = complianceIssues.filter((c) => (c.result as any).status === 'failed');
  if (failedChecks.length > 0) {
    factors.push({
      factor: 'Compliance failures',
      weight: Math.min(failedChecks.length * 0.08, 0.4),
      impact: 'high',
    });
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const probability = Math.min(totalWeight, 0.95);

  return {
    score: 1 - probability, // Higher score = lower risk
    probability,
    factors,
  };
}

/**
 * Build complete reputation layer
 */
export async function buildReputationLayers(clinicianId: string): Promise<ReputationLayer> {
  const [credentialReliability, complianceDiscipline, professionalismInteraction, futureRiskPrediction] =
    await Promise.all([
      buildCredentialReliabilityLayer(clinicianId),
      buildComplianceDisciplineLayer(clinicianId),
      buildProfessionalismInteractionLayer(clinicianId),
      buildFutureRiskPredictionLayer(clinicianId),
    ]);

  return {
    credentialReliability,
    complianceDiscipline,
    professionalismInteraction,
    futureRiskPrediction,
  };
}

/**
 * Get or create reputation layers
 */
export async function getOrCreateReputationLayers(clinicianId: string): Promise<ReputationLayer> {
  let layer = await prisma.reputationLayer.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!layer || isLayerStale(layer.updatedAt)) {
    const layers = await buildReputationLayers(clinicianId);

    if (layer) {
      await prisma.reputationLayer.update({
        where: { id: layer.id },
        data: {
          layers: layers as unknown as any,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.reputationLayer.create({
        data: {
          clinicianId,
          layers: layers as unknown as any,
        },
      });
    }

    return layers;
  }

  return layer.layers as unknown as ReputationLayer;
}

function isLayerStale(updatedAt: Date): boolean {
  const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24; // Refresh if older than 24 hours
}

/**
 * Combine layers into unified reputation score
 */
export async function calculateMultiFactorReputationScore(clinicianId: string): Promise<number> {
  const layers = await getOrCreateReputationLayers(clinicianId);

  const weights = {
    credentialReliability: 0.25,
    complianceDiscipline: 0.30,
    professionalismInteraction: 0.25,
    futureRiskPrediction: 0.20,
  };

  const score =
    layers.credentialReliability.score * weights.credentialReliability +
    layers.complianceDiscipline.score * weights.complianceDiscipline +
    layers.professionalismInteraction.score * weights.professionalismInteraction +
    layers.futureRiskPrediction.score * weights.futureRiskPrediction;

  return Math.max(0, Math.min(1, score));
}

/**
 * Detect gaps between layers (e.g., high skill but poor documentation)
 */
export async function detectAnomalyGaps(clinicianId: string): Promise<Array<{ type: string; severity: string; message: string }>> {
  const layers = await getOrCreateReputationLayers(clinicianId);
  const gaps: Array<{ type: string; severity: string; message: string }> = [];

  // High credential reliability but low compliance
  if (layers.credentialReliability.score > 0.8 && layers.complianceDiscipline.score < 0.6) {
    gaps.push({
      type: 'credential_compliance_gap',
      severity: 'high',
      message: 'High credential reliability but poor compliance discipline',
    });
  }

  // High professionalism but high future risk
  if (layers.professionalismInteraction.score > 0.8 && layers.futureRiskPrediction.probability > 0.5) {
    gaps.push({
      type: 'professionalism_risk_gap',
      severity: 'medium',
      message: 'Good professionalism but elevated future risk prediction',
    });
  }

  // Low compliance but high future risk
  if (layers.complianceDiscipline.score < 0.5 && layers.futureRiskPrediction.probability > 0.6) {
    gaps.push({
      type: 'compliance_risk_gap',
      severity: 'high',
      message: 'Poor compliance discipline correlates with high future risk',
    });
  }

  return gaps;
}

