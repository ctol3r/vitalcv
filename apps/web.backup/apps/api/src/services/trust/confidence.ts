import { computeTemporalTrustScore } from './temporal';
import { getLineageMetrics } from './lineage';
import { getTrustWeightSnapshot } from './weights';

export const TRUST_WEIGHT_THRESHOLD = Number(process.env.TRUST_WEIGHT_THRESHOLD ?? 0.65);
const MAX_DEPTH_PENALTY = Number(process.env.TRUST_DEPTH_PENALTY ?? 0.05);
const MAX_DEPTH_IMPACT = Number(process.env.TRUST_DEPTH_MAX_IMPACT ?? 0.35);

export interface IssuerConfidenceResult {
  issuerDid: string;
  baseWeight: number;
  normalizedWeight: number;
  adjustedWeight: number;
  adjustedNormalized: number;
  confidence: number;
  requiresSecondFactor: boolean;
  lineageDepth: number;
  federationPath: string[];
  trustFloor?: number;
  notes: string[];
}

export interface MultiIssuerConfidenceSummary {
  overallConfidence: number;
  issuers: IssuerConfidenceResult[];
}

export interface MultiIssuerConfidenceInput {
  issuerDid: string;
}

export async function evaluateIssuerConfidence(
  issuerDid: string,
  options: { coIssuers?: string[] } = {},
): Promise<IssuerConfidenceResult> {
  const [weight, temporal, lineage] = await Promise.all([
    getTrustWeightSnapshot(issuerDid),
    computeTemporalTrustScore(issuerDid),
    getLineageMetrics(issuerDid),
  ]);

  let confidence = temporal.adjustedNormalized;
  const notes: string[] = [];

  const depthPenalty = Math.min(MAX_DEPTH_IMPACT, lineage.depth * MAX_DEPTH_PENALTY);
  if (depthPenalty > 0) {
    notes.push(`Federation depth penalty (${lineage.depth} hops)`);
  }
  confidence = clamp01(confidence * (1 - depthPenalty));

  if (lineage.trustFloor && lineage.trustFloor > 3) {
    const federationBoost = Math.min(0.15, (lineage.trustFloor - 3) * 0.02);
    confidence = clamp01(confidence + federationBoost);
  }

  if (options.coIssuers?.length) {
    const peerBoost = Math.min(0.1, options.coIssuers.length * 0.02);
    confidence = clamp01(confidence + peerBoost);
    notes.push(`Multi-issuer disclosure (+${(peerBoost * 100).toFixed(0)}bps)`);
  }

  if (temporal.status !== 'healthy') {
    notes.push(`Issuer inactive for ${temporal.monthsInactive.toFixed(1)} months`);
  }

  const requiresSecondFactor = confidence < TRUST_WEIGHT_THRESHOLD;
  if (requiresSecondFactor) {
    notes.push(`Below trust threshold (${TRUST_WEIGHT_THRESHOLD}) - capture second factor`);
  }

  return {
    issuerDid,
    baseWeight: weight.weight,
    normalizedWeight: weight.normalizedWeight,
    adjustedWeight: temporal.adjustedWeight,
    adjustedNormalized: temporal.adjustedNormalized,
    confidence,
    requiresSecondFactor,
    lineageDepth: lineage.depth,
    federationPath: lineage.path,
    trustFloor: lineage.trustFloor,
    notes,
  };
}

export async function calculateMultiIssuerConfidence(
  inputs: MultiIssuerConfidenceInput[],
): Promise<MultiIssuerConfidenceSummary> {
  if (!inputs.length) {
    return {
      overallConfidence: 0,
      issuers: [],
    };
  }

  const coIssuers = inputs.map((entry) => entry.issuerDid);
  const issuers = await Promise.all(
    inputs.map((entry) =>
      evaluateIssuerConfidence(entry.issuerDid, {
        coIssuers: coIssuers.filter((did) => did !== entry.issuerDid),
      }),
    ),
  );

  const overallConfidence =
    issuers.reduce((sum, issuer) => sum + issuer.confidence, 0) / issuers.length;

  return {
    overallConfidence: Number(overallConfidence.toFixed(3)),
    issuers,
  };
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(3));
}

