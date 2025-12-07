import type { ClinicianSupplySummary } from '../graph/buildSupplyGraph.js';

export interface SupplyReadinessInput {
  clinicianId: string;
  summary: ClinicianSupplySummary;
  averageLicenseDaysToExpire?: number;
  privilegeHoldCount?: number;
  complianceFindings?: number;
  openDriftSignals?: number;
  credentialRiskScore?: number;
  fusionScore?: number; // 0–1 scale
}

export interface SupplyReadinessComponents {
  credentialFreshness: number;
  privilegeReadiness: number;
  compliance: number;
  drift: number;
  credentialRiskPenalty: number;
  fusionMultiplier: number;
}

export interface SupplyReadinessResult {
  clinicianId: string;
  score: number;
  components: SupplyReadinessComponents;
  rationale: string[];
}

export interface ReadinessWeights {
  credentialFreshness: number;
  privilegeReadiness: number;
  compliance: number;
  drift: number;
}

const DEFAULT_WEIGHTS: ReadinessWeights = {
  credentialFreshness: 0.35,
  privilegeReadiness: 0.25,
  compliance: 0.2,
  drift: 0.2,
};

export function computeSupplyReadinessScore(
  input: SupplyReadinessInput,
  options: { weights?: ReadinessWeights } = {},
): SupplyReadinessResult {
  const weights = normalizeWeights(options.weights ?? DEFAULT_WEIGHTS);
  const components = calculateComponents(input);

  const weightedScore =
    components.credentialFreshness * weights.credentialFreshness +
    components.privilegeReadiness * weights.privilegeReadiness +
    components.compliance * weights.compliance +
    components.drift * weights.drift;

  const baseScore = weightedScore * 100;
  const penalty = components.credentialRiskPenalty * 25;
  const adjusted = clampScore((baseScore - penalty) * components.fusionMultiplier);

  return {
    clinicianId: input.clinicianId,
    score: adjusted,
    components,
    rationale: buildRationale(input, components, adjusted),
  };
}

function calculateComponents(input: SupplyReadinessInput): SupplyReadinessComponents {
  const freshness = deriveCredentialFreshness(input);
  const privilegeReadiness = derivePrivilegeReadiness(input.summary, input.privilegeHoldCount);
  const compliance = deriveComplianceScore(input.complianceFindings);
  const drift = deriveDriftScore(input.openDriftSignals);
  const credentialRiskPenalty = clamp01((input.credentialRiskScore ?? 0) / 100);
  const fusionMultiplier = deriveFusionMultiplier(input.fusionScore);

  return {
    credentialFreshness: freshness,
    privilegeReadiness,
    compliance,
    drift,
    credentialRiskPenalty,
    fusionMultiplier,
  };
}

function deriveCredentialFreshness(input: SupplyReadinessInput): number {
  const { summary, averageLicenseDaysToExpire } = input;
  const licenseRatio = summary.licenses > 0 ? Math.min(1, summary.licenses / 3) : 0;
  const expiry = averageLicenseDaysToExpire ?? 60;
  const freshnessByTime = clamp01(expiry / 90);
  return clamp01((licenseRatio + freshnessByTime) / 2);
}

function derivePrivilegeReadiness(summary: ClinicianSupplySummary, holds?: number): number {
  if (summary.privileges === 0) {
    return 0;
  }
  const privilegeDepth = Math.min(1, summary.privileges / Math.max(1, summary.orgsApproved.length || 1));
  const holdPenalty = holds ? clamp01(holds / Math.max(1, summary.privileges)) : 0;
  return clamp01(privilegeDepth * (1 - holdPenalty));
}

function deriveComplianceScore(findings?: number): number {
  if (!findings || findings <= 0) {
    return 1;
  }
  return clamp01(1 - Math.min(1, findings / 5));
}

function deriveDriftScore(openSignals?: number): number {
  if (!openSignals || openSignals <= 0) {
    return 1;
  }
  return clamp01(1 - Math.min(1, openSignals / 5));
}

function deriveFusionMultiplier(fusionScore?: number): number {
  const normalized = clamp01(fusionScore ?? 0.85);
  return 0.7 + normalized * 0.3;
}

function normalizeWeights(weights: ReadinessWeights): ReadinessWeights {
  const total =
    weights.credentialFreshness +
    weights.privilegeReadiness +
    weights.compliance +
    weights.drift;
  if (total === 0) {
    return DEFAULT_WEIGHTS;
  }
  return {
    credentialFreshness: weights.credentialFreshness / total,
    privilegeReadiness: weights.privilegeReadiness / total,
    compliance: weights.compliance / total,
    drift: weights.drift / total,
  };
}

function buildRationale(
  input: SupplyReadinessInput,
  components: SupplyReadinessComponents,
  score: number,
): string[] {
  const messages: string[] = [];

  if (components.credentialFreshness < 0.7) {
    messages.push('Renew state licenses or update credential data to boost freshness.');
  }
  if (components.privilegeReadiness < 0.7) {
    messages.push('Expand or re-evaluate privilege portfolio for target orgs.');
  }
  if (components.compliance < 0.8) {
    messages.push('Resolve outstanding compliance findings (NCQA/TJC).');
  }
  if (components.drift < 0.8) {
    messages.push('Investigate open drift signals before onboarding.');
  }
  if (components.credentialRiskPenalty > 0.2) {
    messages.push('High credential risk score detected; close remediation tasks.');
  }
  if (components.fusionMultiplier < 0.8) {
    messages.push('Quality FusionScore is low; review quality/experience data.');
  }
  if (!messages.length) {
    messages.push('Clinician appears supply-ready across licenses, privileges, and payers.');
  } else {
    messages.push(`Composite readiness scored ${score.toFixed(1)} out of 100.`);
  }

  return messages;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

