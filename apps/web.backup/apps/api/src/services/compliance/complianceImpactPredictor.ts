import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface ComplianceImpactData {
  ruleImpact: Record<string, {
    timeImpact: number; // hours
    costImpact: number; // dollars
    effortImpact: number; // 0-1
  }>;
  sensitivity: {
    employer: number;
    clinician: number;
  };
  scenarios: Array<{
    name: string;
    impact: number;
    probability: number;
  }>;
  mitigation: Array<{
    workflow: string;
    impactReduction: number;
  }>;
  regionWideImpact: {
    workforceSupply: number;
    cost: number;
  };
}

/**
 * Task 361.2 — Rule→impact mapping engine v4
 * Map each rule to time/cost/effort impact
 */
export async function mapRuleImpact(
  region: string,
  rules: Array<{ id: string; name: string; type: string }>,
): Promise<ComplianceImpactData['ruleImpact']> {
  const impact: Record<string, any> = {};

  rules.forEach(rule => {
    // Estimate impact based on rule type
    let timeImpact = 5; // hours
    let costImpact = 1000; // dollars
    let effortImpact = 0.3;

    if (rule.type === 'licensing') {
      timeImpact = 20;
      costImpact = 5000;
      effortImpact = 0.7;
    } else if (rule.type === 'credentialing') {
      timeImpact = 15;
      costImpact = 3000;
      effortImpact = 0.6;
    } else if (rule.type === 'reporting') {
      timeImpact = 10;
      costImpact = 2000;
      effortImpact = 0.4;
    }

    impact[rule.id] = {
      timeImpact,
      costImpact,
      effortImpact,
    };
  });

  return impact;
}

/**
 * Task 361.3 — Compliance sensitivity analyzer
 * Measure employer or clinician sensitivity to new rules
 */
export async function analyzeComplianceSensitivity(
  region: string,
): Promise<{ employer: number; clinician: number }> {
  // Check historical compliance events
  const events = await prisma.regulatoryEvent.findMany({
    where: {
      authorityCode: { contains: region },
    },
    orderBy: { occurredAt: 'desc' },
    take: 20,
  });

  // Higher event frequency = higher sensitivity
  const eventFrequency = events.length / 12; // per month over last year
  const employerSensitivity = Math.min(1, eventFrequency * 0.2);
  const clinicianSensitivity = Math.min(1, eventFrequency * 0.15);

  return {
    employer: employerSensitivity,
    clinician: clinicianSensitivity,
  };
}

/**
 * Task 361.5 — Regulatory shock scenario builder
 * Simulate abrupt rule changes
 */
export async function buildRegulatoryShockScenarios(
  region: string,
): Promise<ComplianceImpactData['scenarios']> {
  return [
    {
      name: 'Sudden License Requirement Change',
      impact: 0.8,
      probability: 0.3,
    },
    {
      name: 'New Background Check Mandate',
      impact: 0.6,
      probability: 0.4,
    },
    {
      name: 'Credentialing Process Overhaul',
      impact: 0.9,
      probability: 0.2,
    },
    {
      name: 'Reporting Frequency Increase',
      impact: 0.4,
      probability: 0.5,
    },
  ];
}

/**
 * Task 361.6 — Compliance mitigation suggestions
 * Suggest workflows minimizing impact
 */
export async function suggestMitigations(
  region: string,
  ruleImpacts: ComplianceImpactData['ruleImpact'],
): Promise<ComplianceImpactData['mitigation']> {
  const mitigations: Array<{ workflow: string; impactReduction: number }> = [];

  Object.entries(ruleImpacts).forEach(([ruleId, impact]) => {
    if (impact.timeImpact > 15) {
      mitigations.push({
        workflow: `Automate ${ruleId} processing`,
        impactReduction: 0.6,
      });
    }
    if (impact.effortImpact > 0.6) {
      mitigations.push({
        workflow: `Streamline ${ruleId} workflow`,
        impactReduction: 0.4,
      });
    }
  });

  return mitigations;
}

/**
 * Task 361.7 — Region-wide impact modeling
 * Predict how new rules affect workforce supply
 */
export async function modelRegionWideImpact(
  region: string,
  ruleImpacts: ComplianceImpactData['ruleImpact'],
): Promise<{ workforceSupply: number; cost: number }> {
  const totalCost = Object.values(ruleImpacts).reduce((sum, impact) => sum + impact.costImpact, 0);
  const totalTime = Object.values(ruleImpacts).reduce((sum, impact) => sum + impact.timeImpact, 0);

  // Estimate workforce supply impact (negative correlation with time/cost)
  const supplyImpact = Math.max(0, 1 - (totalTime / 100) - (totalCost / 100000));

  return {
    workforceSupply: supplyImpact,
    cost: totalCost,
  };
}

/**
 * Get complete compliance impact data
 */
export async function getComplianceImpact(
  region: string,
): Promise<ComplianceImpactData> {
  const predictor = await prisma.complianceImpactPredictor.findUnique({
    where: { region },
  });

  if (predictor) {
    return predictor.impact as ComplianceImpactData;
  }

  // Create initial impact predictor
  const sampleRules = [
    { id: 'rule1', name: 'License Renewal', type: 'licensing' },
    { id: 'rule2', name: 'Background Check', type: 'credentialing' },
    { id: 'rule3', name: 'Monthly Report', type: 'reporting' },
  ];

  const ruleImpact = await mapRuleImpact(region, sampleRules);
  const sensitivity = await analyzeComplianceSensitivity(region);
  const scenarios = await buildRegulatoryShockScenarios(region);
  const mitigation = await suggestMitigations(region, ruleImpact);
  const regionWideImpact = await modelRegionWideImpact(region, ruleImpact);

  const data: ComplianceImpactData = {
    ruleImpact,
    sensitivity,
    scenarios,
    mitigation,
    regionWideImpact,
  };

  await prisma.complianceImpactPredictor.create({
    data: {
      region,
      impact: data,
    },
  });

  return data;
}

/**
 * Task 361.8 — Compliance horizon integration
 * Merge with future-rule forecasts
 */
export async function integrateComplianceHorizon(
  region: string,
): Promise<Array<{ rule: string; effectiveDate: string; impact: number }>> {
  // Would integrate with compliance horizon service
  return [
    {
      rule: 'New CME Requirement',
      effectiveDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      impact: 0.5,
    },
  ];
}

/**
 * Task 361.9 — Impact export pack
 * Operational readiness briefing
 */
export async function exportImpactReport(
  region: string,
): Promise<{
  impact: ComplianceImpactData;
  horizon: Array<{ rule: string; effectiveDate: string; impact: number }>;
  summary: string;
  readinessScore: number;
}> {
  const impact = await getComplianceImpact(region);
  const horizon = await integrateComplianceHorizon(region);

  const totalImpact = Object.values(impact.ruleImpact).reduce((sum, i) => sum + i.effortImpact, 0) / Object.keys(impact.ruleImpact).length;
  const readinessScore = Math.max(0, Math.min(1, 1 - totalImpact));

  const summary = `Compliance impact analysis for ${region}.
    Total estimated cost: $${impact.regionWideImpact.cost.toLocaleString()}.
    Workforce supply impact: ${(impact.regionWideImpact.workforceSupply * 100).toFixed(1)}%.`;

  return {
    impact,
    horizon,
    summary,
    readinessScore,
  };
}

/**
 * Task 361.10 — Anchor compliance impact snapshot
 */
export async function anchorComplianceImpactSnapshot(
  region: string,
): Promise<string> {
  const impact = await getComplianceImpact(region);

  const receipt = await chainClient.submitAuditEvent({
    eventType: 'complianceImpactAnchored',
    correlationId: region,
    tags: ['compliance', 'impact', 'snapshot'],
    payload: {
      region,
      totalCost: impact.regionWideImpact.cost,
      workforceImpact: impact.regionWideImpact.workforceSupply,
      sensitivity: impact.sensitivity,
      anchoredAt: new Date().toISOString(),
    },
  });

  return receipt.txHash || receipt.eventId;
}

