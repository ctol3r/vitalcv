export interface WorkforceSignalInput {
  specialty: string;
  region?: string;
  licenseIssuanceVelocity: number;
  expiringCredentials: number;
  sanctionsDensity: number;
  compactEligibilityRate: number;
  seasonalTrend?: number;
  retirementsProjection?: number;
  weight?: number;
}

export interface WorkforcePredictionRationale {
  issuancePressure: number;
  credentialChurn: number;
  sanctionsDrag: number;
  compactReliefGap: number;
  summary: string[];
}

export interface DriverBreakdown {
  issuancePressure: number;
  credentialChurn: number;
  sanctionsDrag: number;
  compactReliefGap: number;
}

export interface SpecialtyShortageInsight extends WorkforceSignalInput {
  shortageIndex: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  drivers: DriverBreakdown;
}

export interface WorkforcePredictionResult {
  shortageIndex: number;
  rationale: WorkforcePredictionRationale;
  affectedSpecialties: SpecialtyShortageInsight[];
}

const IDEAL_LICENSE_VELOCITY = 18; // issuances per specialty per quarter
const MAX_EXPIRING_CREDENTIALS = 140;
const MAX_SANCTIONS_DENSITY = 0.35;

export function computeWorkforceShortage(inputs: WorkforceSignalInput[]): WorkforcePredictionResult {
  if (!inputs.length) {
    return {
      shortageIndex: 0,
      rationale: {
        issuancePressure: 0,
        credentialChurn: 0,
        sanctionsDrag: 0,
        compactReliefGap: 0,
        summary: ['No predictor inputs available for this organization.'],
      },
      affectedSpecialties: [],
    };
  }

  const insights = inputs.map((input) => buildSpecialtyInsight(input));
  const aggregate = aggregateInsights(insights);

  return {
    shortageIndex: aggregate.shortageIndex,
    rationale: aggregate.rationale,
    affectedSpecialties: insights.filter((insight) => insight.shortageIndex >= 0.4),
  };
}

function buildSpecialtyInsight(input: WorkforceSignalInput): SpecialtyShortageInsight {
  const issuancePressure = clamp01(1 - (input.licenseIssuanceVelocity / IDEAL_LICENSE_VELOCITY));
  const credentialChurn = clamp01(input.expiringCredentials / MAX_EXPIRING_CREDENTIALS);
  const sanctionsDrag = clamp01(input.sanctionsDensity / MAX_SANCTIONS_DENSITY);
  const compactReliefGap = clamp01(1 - input.compactEligibilityRate);

  const seasonalAdjustment = input.seasonalTrend ?? 0;
  const retirementsPenalty = clamp01((input.retirementsProjection ?? 0) / 50);

  const baseScore =
    issuancePressure * 0.25 +
    credentialChurn * 0.3 +
    sanctionsDrag * 0.25 +
    compactReliefGap * 0.2;

  const shortageIndex = clamp01(baseScore + seasonalAdjustment * 0.05 + retirementsPenalty * 0.1);

  return {
    ...input,
    shortageIndex,
    severity: categorize(shortageIndex),
    drivers: {
      issuancePressure,
      credentialChurn,
      sanctionsDrag,
      compactReliefGap,
    },
  };
}

function aggregateInsights(insights: SpecialtyShortageInsight[]) {
  const totals = {
    weight: 0,
    shortage: 0,
    issuance: 0,
    churn: 0,
    sanctions: 0,
    compact: 0,
  };

  insights.forEach((insight) => {
    const weight = insight.weight ?? (1 + clamp01(insight.expiringCredentials / 50));
    totals.weight += weight;
    totals.shortage += insight.shortageIndex * weight;
    totals.issuance += insight.drivers.issuancePressure * weight;
    totals.churn += insight.drivers.credentialChurn * weight;
    totals.sanctions += insight.drivers.sanctionsDrag * weight;
    totals.compact += insight.drivers.compactReliefGap * weight;
  });

  const shortageIndex = totals.weight > 0 ? clamp01(totals.shortage / totals.weight) : 0;
  const issuancePressure = totals.weight > 0 ? clamp01(totals.issuance / totals.weight) : 0;
  const credentialChurn = totals.weight > 0 ? clamp01(totals.churn / totals.weight) : 0;
  const sanctionsDrag = totals.weight > 0 ? clamp01(totals.sanctions / totals.weight) : 0;
  const compactReliefGap = totals.weight > 0 ? clamp01(totals.compact / totals.weight) : 0;

  const summary = buildSummary({
    shortageIndex,
    issuancePressure,
    credentialChurn,
    sanctionsDrag,
    compactReliefGap,
    insights,
  });

  return {
    shortageIndex,
    rationale: {
      issuancePressure,
      credentialChurn,
      sanctionsDrag,
      compactReliefGap,
      summary,
    },
  };
}

function buildSummary({
  shortageIndex,
  issuancePressure,
  credentialChurn,
  sanctionsDrag,
  compactReliefGap,
  insights,
}: {
  shortageIndex: number;
  issuancePressure: number;
  credentialChurn: number;
  sanctionsDrag: number;
  compactReliefGap: number;
  insights: SpecialtyShortageInsight[];
}): string[] {
  const notes: string[] = [];

  if (shortageIndex >= 0.75) {
    notes.push('Critical supply shortage detected across multiple specialties.');
  } else if (shortageIndex >= 0.5) {
    notes.push('Elevated workforce shortage risk; monitor hiring velocity closely.');
  } else {
    notes.push('Supply and demand are balanced but sensitive to churn.');
  }

  if (credentialChurn >= 0.6) {
    notes.push('High volume of expiring credentials is driving shortage risk.');
  }
  if (issuancePressure >= 0.6) {
    notes.push('License issuance velocity is below the stabilization threshold.');
  }
  if (sanctionsDrag >= 0.5) {
    notes.push('Recent sanctions density is constraining available clinicians.');
  }
  if (compactReliefGap >= 0.4) {
    notes.push('Compact eligibility is insufficient to offset current demand.');
  }

  const mostImpacted = insights
    .filter((insight) => insight.shortageIndex >= 0.5)
    .sort((a, b) => b.shortageIndex - a.shortageIndex)
    .slice(0, 3);

  if (mostImpacted.length) {
    const names = mostImpacted.map((insight) => insight.specialty).join(', ');
    notes.push(`Hot spots: ${names}.`);
  }

  return notes;
}

function categorize(score: number): SpecialtyShortageInsight['severity'] {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'moderate';
  return 'low';
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

