import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface RuleChangePrediction {
  rule: string;
  probability: number;
  timeframe: string;
  impact: string;
  region: string;
}

export interface ComplianceHorizon {
  region: string;
  horizon: {
    predictions: RuleChangePrediction[];
    regionMapping: Record<string, {
      burden: number;
      difficulty: number;
      requirements: string[];
    }>;
    stressEstimates: Record<string, number>;
    crossJurisdiction: Record<string, {
      rules: string[];
      divergence: number;
    }>;
    discrepancies: Array<{
      type: string;
      severity: number;
      regions: string[];
    }>;
    futureRisk: number;
    updatedAt: string;
  };
  updatedAt: string;
}

/**
 * Task 355.2 — Rule-change prediction model v3
 * Predict regulatory updates using historical patterns
 */
export async function predictRuleChanges(region: string): Promise<RuleChangePrediction[]> {
  const predictions: RuleChangePrediction[] = [];

  // Get historical regulatory events
  const events = await prisma.regulatoryEvent.findMany({
    where: { authorityCode: region },
    orderBy: { occurredAt: 'desc' },
    take: 50,
  });

  // Analyze patterns
  const eventTypes = new Map<string, number>();
  events.forEach((e) => {
    eventTypes.set(e.eventType, (eventTypes.get(e.eventType) || 0) + 1);
  });

  // Predict based on frequency
  for (const [eventType, count] of eventTypes.entries()) {
    if (count >= 3) {
      predictions.push({
        rule: eventType,
        probability: Math.min(count / 10, 0.9),
        timeframe: '30-90 days',
        impact: 'medium',
        region,
      });
    }
  }

  // Add default predictions
  if (predictions.length === 0) {
    predictions.push({
      rule: 'license_renewal_requirements',
      probability: 0.6,
      timeframe: '60-120 days',
      impact: 'low',
      region,
    });
  }

  return predictions;
}

/**
 * Task 355.4 — Region-specific horizon mapping
 * Forecast compliance burdens per region
 */
export async function mapRegionHorizon(region: string): Promise<Record<string, {
  burden: number;
  difficulty: number;
  requirements: string[];
}>> {
  const mapping: Record<string, {
    burden: number;
    difficulty: number;
    requirements: string[];
  }> = {};

  // Get regulatory snapshots for region
  const snapshots = await prisma.regulatoryRuleSnapshot.findMany({
    where: { authorityCode: region },
    orderBy: { fetchedAt: 'desc' },
    take: 10,
  });

  for (const snapshot of snapshots) {
    const payload = snapshot.payload as Record<string, unknown>;
    const requirements = (payload.requirements as string[]) || [];

    mapping[region] = {
      burden: requirements.length * 0.1, // Estimate burden
      difficulty: 0.6, // Default difficulty
      requirements,
    };
  }

  // Default if no snapshots
  if (!mapping[region]) {
    mapping[region] = {
      burden: 0.5,
      difficulty: 0.5,
      requirements: ['license_verification', 'background_check'],
    };
  }

  return mapping;
}

/**
 * Task 355.5 — Horizon stress estimator
 * Predict how difficult upcoming requirements will be
 */
export async function estimateHorizonStress(region: string): Promise<Record<string, number>> {
  const stressEstimates: Record<string, number> = {};

  const predictions = await predictRuleChanges(region);
  const mapping = await mapRegionHorizon(region);

  for (const prediction of predictions) {
    const regionData = mapping[region];
    if (regionData) {
      stressEstimates[prediction.rule] =
        regionData.burden * 0.5 + regionData.difficulty * 0.5;
    } else {
      stressEstimates[prediction.rule] = 0.5;
    }
  }

  return stressEstimates;
}

/**
 * Task 355.6 — Cross-jurisdiction horizon integrator
 * Compare future rules across countries
 */
export async function integrateCrossJurisdictionHorizon(
  regions: string[],
): Promise<Record<string, { rules: string[]; divergence: number }>> {
  const crossJurisdiction: Record<string, { rules: string[]; divergence: number }> = {};

  const allPredictions: Record<string, string[]> = {};

  for (const region of regions) {
    const predictions = await predictRuleChanges(region);
    allPredictions[region] = predictions.map((p) => p.rule);
  }

  // Compute divergence
  for (const region of regions) {
    const rules = allPredictions[region] || [];
    const otherRules = Object.values(allPredictions)
      .flat()
      .filter((r) => !rules.includes(r));

    const divergence = otherRules.length / Math.max(rules.length, 1);

    crossJurisdiction[region] = {
      rules,
      divergence: Math.min(divergence, 1),
    };
  }

  return crossJurisdiction;
}

/**
 * Task 355.7 — Horizon discrepancy detector
 * Detect diverging regulatory paths
 */
export async function detectHorizonDiscrepancies(
  regions: string[],
): Promise<Array<{ type: string; severity: number; regions: string[] }>> {
  const discrepancies: Array<{ type: string; severity: number; regions: string[] }> = [];

  const crossJurisdiction = await integrateCrossJurisdictionHorizon(regions);

  for (const [region, data] of Object.entries(crossJurisdiction)) {
    if (data.divergence > 0.5) {
      discrepancies.push({
        type: 'regulatory_divergence',
        severity: data.divergence,
        regions: [region],
      });
    }
  }

  return discrepancies;
}

/**
 * Task 355.8 — Compliance future-risk scoring
 * Score future compliance risk 0–100
 */
export async function scoreFutureComplianceRisk(region: string): Promise<number> {
  const predictions = await predictRuleChanges(region);
  const stressEstimates = await estimateHorizonStress(region);
  const discrepancies = await detectHorizonDiscrepancies([region]);

  // Compute risk score (0-100)
  const predictionRisk = predictions.reduce((sum, p) => sum + p.probability * 20, 0);
  const stressRisk = Object.values(stressEstimates).reduce((sum, s) => sum + s * 20, 0);
  const discrepancyRisk = discrepancies.reduce((sum, d) => sum + d.severity * 20, 0);

  const risk = Math.min(
    (predictionRisk + stressRisk + discrepancyRisk) / 3,
    100,
  );

  return risk;
}

/**
 * Task 355.1 — Get or create compliance horizon
 */
export async function getOrCreateComplianceHorizon(region: string): Promise<ComplianceHorizon> {
  const existing = await prisma.complianceHorizon.findFirst({
    where: { region },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return {
      region,
      horizon: existing.horizon as ComplianceHorizon['horizon'],
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create new horizon
  const predictions = await predictRuleChanges(region);
  const regionMapping = await mapRegionHorizon(region);
  const stressEstimates = await estimateHorizonStress(region);
  const crossJurisdiction = await integrateCrossJurisdictionHorizon([region]);
  const discrepancies = await detectHorizonDiscrepancies([region]);
  const futureRisk = await scoreFutureComplianceRisk(region);

  const horizon: ComplianceHorizon = {
    region,
    horizon: {
      predictions,
      regionMapping,
      stressEstimates,
      crossJurisdiction,
      discrepancies,
      futureRisk,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  await prisma.complianceHorizon.create({
    data: {
      region,
      horizon: horizon.horizon as unknown as Record<string, unknown>,
    },
  });

  return horizon;
}

/**
 * Task 355.9 — Export horizon export pack
 */
export async function exportHorizonPack(region: string): Promise<{
  summary: string;
  pdfData: string;
}> {
  const horizon = await getOrCreateComplianceHorizon(region);

  const summary = `
Compliance Horizon Forecast - ${region}
Generated: ${horizon.horizon.updatedAt}

Rule Change Predictions: ${horizon.horizon.predictions.length}
Future Risk Score: ${horizon.horizon.futureRisk.toFixed(1)}/100

Region Mapping:
${Object.entries(horizon.horizon.regionMapping)
  .map(([r, data]) => `  ${r}: Burden ${(data.burden * 100).toFixed(1)}%, Difficulty ${(data.difficulty * 100).toFixed(1)}%`)
  .join('\n')}

Stress Estimates:
${Object.entries(horizon.horizon.stressEstimates)
  .map(([rule, stress]) => `  ${rule}: ${(stress * 100).toFixed(1)}%`)
  .join('\n')}

Discrepancies: ${horizon.horizon.discrepancies.length}
  `.trim();

  const pdfData = JSON.stringify(horizon, null, 2);

  return { summary, pdfData };
}

/**
 * Task 355.10 — Anchor compliance horizon snapshot
 */
export async function anchorComplianceHorizonSnapshot(region: string): Promise<void> {
  const horizon = await getOrCreateComplianceHorizon(region);

  const horizonHash = createHash('sha256')
    .update(JSON.stringify(horizon))
    .digest('hex');

  anchorEvent('complianceHorizonAnchored', {
    region,
    horizonHash,
    predictionCount: horizon.horizon.predictions.length,
    futureRisk: horizon.horizon.futureRisk,
    discrepancyCount: horizon.horizon.discrepancies.length,
    timestamp: new Date().toISOString(),
  });
}

