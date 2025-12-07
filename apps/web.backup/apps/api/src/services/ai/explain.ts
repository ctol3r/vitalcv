import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { recordAiIncident, type AiIncidentRecord } from './incident-log';
import { injectNistGenAiRiskTags, type BiasFlagReference, type RiskAssessmentEntry } from './risk-injector';
import { anchorAiDecision } from '../audit/anchor';

const prisma = new PrismaClient();

export type BiasFlagSeverity = BiasFlagReference['severity'];

export interface ModelIntrospectionInput {
  decision: string;
  outcome: string;
  features: Record<string, number | null | undefined>;
  weights?: Record<string, number | null | undefined>;
  biasIndicators?: BiasFlagReference[];
  reference?: {
    jobId?: string;
    clinicianId?: string;
    actor?: string;
  };
  chainContext?: {
    expected: string;
    observed?: string;
  };
  decisionId?: string;
}

export interface TopFeature {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
  direction: 'positive' | 'negative';
}

export interface ModelIntrospectionResult {
  decisionId: string;
  timestamp: string;
  topFeatures: TopFeature[];
  biasFlags: BiasFlagReference[];
  confidence: number;
  riskTags: RiskAssessmentEntry[];
  incidents: AiIncidentRecord[];
}

export async function introspectModelDecision(
  input: ModelIntrospectionInput,
): Promise<ModelIntrospectionResult> {
  if (!input.decision) {
    throw new Error('decision_descriptor_required');
  }
  if (!input.outcome) {
    throw new Error('decision_outcome_required');
  }

  const timestamp = new Date().toISOString();
  const decisionId = input.decisionId ?? randomUUID();
  const incidentTrail: AiIncidentRecord[] = [];

  const features = sanitizeFeatureMap(input.features, input.decision, incidentTrail);
  const weights = sanitizeWeightMap(input.weights ?? {}, input.decision, incidentTrail);

  if (input.chainContext && input.chainContext.expected !== input.chainContext.observed) {
    incidentTrail.push(
      recordAiIncident({
        event: 'chain_mismatch',
        detail: `Expected chain ${input.chainContext.expected} but observed ${input.chainContext.observed ?? 'unknown'}.`,
        decision: input.decision,
        severity: 'high',
        context: {
          expected: input.chainContext.expected,
          observed: input.chainContext.observed ?? null,
        },
      }),
    );
  }

  const contributions = buildContributions(features, weights);
  const sorted = contributions.sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );
  const topFeatures = sorted.slice(0, 5);

  const biasFlags = mergeBiasFlags(topFeatures, input.biasIndicators ?? []);
  const confidence = deriveModelConfidence(topFeatures, biasFlags, incidentTrail);

  const riskTags = injectNistGenAiRiskTags({
    anomalies: incidentTrail,
    biasFlags,
    confidence,
    dominantContribution: Math.abs(topFeatures[0]?.contribution ?? 0),
  });

  await prisma.explainableDecision
    .create({
      data: {
        id: decisionId,
        decision: input.decision,
        features,
        weights,
        outcome: input.outcome,
        timestamp,
      },
    })
    .catch((error) => {
      console.warn('[ai][explain] failed to persist explainable decision', error);
    });

  anchorAiDecision({
    decisionId,
    decision: input.decision,
    outcome: input.outcome,
    topFeature: topFeatures[0]?.feature ?? null,
    confidence,
    riskTags: riskTags.filter((tag) => tag.triggered).map((tag) => tag.id),
    biasFlags: biasFlags.map((flag) => ({
      feature: flag.feature,
      severity: flag.severity,
    })),
    timestamp,
    metadata: input.reference ?? {},
  });

  return {
    decisionId,
    timestamp,
    topFeatures,
    biasFlags,
    confidence,
    riskTags,
    incidents: incidentTrail,
  };
}

function sanitizeFeatureMap(
  features: Record<string, number | null | undefined>,
  decision: string,
  incidentTrail: AiIncidentRecord[],
): Record<string, number> {
  const sanitized: Record<string, number> = {};
  Object.entries(features ?? {}).forEach(([key, rawValue]) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      incidentTrail.push(
        recordAiIncident({
          event: 'hallucinated_fields',
          detail: `Feature ${key} produced a non-finite value.`,
          decision,
          severity: 'medium',
          context: { feature: key, value: rawValue },
        }),
      );
      return;
    }
    sanitized[key] = value;
  });
  return sanitized;
}

function sanitizeWeightMap(
  weights: Record<string, number | null | undefined>,
  decision: string,
  incidentTrail: AiIncidentRecord[],
): Record<string, number> {
  const sanitized: Record<string, number> = {};
  Object.entries(weights).forEach(([key, rawValue]) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      incidentTrail.push(
        recordAiIncident({
          event: 'unexpected_weights',
          detail: `Weight ${key} is not numeric.`,
          decision,
          severity: 'medium',
          context: { feature: key, weight: rawValue },
        }),
      );
      return;
    }

    if (Math.abs(value) > 5) {
      incidentTrail.push(
        recordAiIncident({
          event: 'unexpected_weights',
          detail: `Weight ${key} exceeded safety bounds (${value}).`,
          decision,
          severity: 'high',
          context: { feature: key, weight: value },
        }),
      );
    }

    sanitized[key] = value;
  });

  return sanitized;
}

function buildContributions(features: Record<string, number>, weights: Record<string, number>) {
  return Object.entries(features).map(([feature, value]) => {
    const weight = weights[feature] ?? 1;
    const contribution = Number((value * weight).toFixed(5));
    return {
      feature,
      value,
      weight,
      contribution,
      direction: contribution >= 0 ? 'positive' : 'negative',
    };
  });
}

function mergeBiasFlags(
  topFeatures: TopFeature[],
  providedFlags: BiasFlagReference[],
): BiasFlagReference[] {
  const autoFlags: BiasFlagReference[] = topFeatures
    .filter((feature) => feature.direction === 'negative' && Math.abs(feature.contribution) > 0.6)
    .map((feature) => ({
      feature: feature.feature,
      description: 'Negative contribution exceeded fairness boundary.',
      severity: Math.abs(feature.contribution) > 1 ? 'high' : 'medium',
      source: 'model',
    }));

  const merged = [...providedFlags, ...autoFlags];
  const deduped = new Map<string, BiasFlagReference>();
  merged.forEach((flag) => {
    const existing = deduped.get(flag.feature);
    if (!existing) {
      deduped.set(flag.feature, flag);
      return;
    }
    deduped.set(flag.feature, prioritizeSeverity(existing, flag));
  });

  return Array.from(deduped.values());
}

function prioritizeSeverity(
  a: BiasFlagReference,
  b: BiasFlagReference,
): BiasFlagReference {
  const severityRank = { low: 1, medium: 2, high: 3 } as const;
  return severityRank[b.severity] > severityRank[a.severity] ? b : a;
}

function deriveModelConfidence(
  features: TopFeature[],
  biasFlags: BiasFlagReference[],
  incidents: AiIncidentRecord[],
): number {
  if (!features.length) {
    return 0.4;
  }

  const contributionStrength =
    features.reduce((sum, feature) => sum + Math.abs(feature.contribution), 0) /
    features.length;
  const biasPenalty = biasFlags.reduce((sum, flag) => {
    if (flag.severity === 'high') return sum + 0.18;
    if (flag.severity === 'medium') return sum + 0.1;
    return sum + 0.04;
  }, 0);
  const incidentPenalty = incidents.reduce((sum, incident) => {
    if (incident.severity === 'high') return sum + 0.2;
    if (incident.severity === 'medium') return sum + 0.08;
    return sum + 0.03;
  }, 0);

  const raw = 0.55 + contributionStrength * 0.25 - biasPenalty - incidentPenalty;
  return clamp(raw, 0.25, 0.98);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function summarizeTopFeatures(
  features: Record<string, number>,
  weights: Record<string, number>,
  limit = 5,
): TopFeature[] {
  return buildContributions(features, weights)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}


