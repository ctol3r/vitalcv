export interface ProviderComparisonPublicationMetrics {
  totalPublications: number;
  citationCount: number;
  recentPublications: number;
}

export interface ProviderComparisonFundingMetrics {
  totalIndustryPayments: number;
  paymentRecordCount: number;
  uniquePayers: number;
  sharedGrantCount: number;
}

export interface ProviderComparisonTrialMetrics {
  totalTrials: number;
  activeTrials: number;
  principalInvestigatorRoles: number;
}

export interface ProviderComparisonInput {
  npi: string;
  providerName: string;
  primarySpecialty: string | null;
  secondarySpecialties: string[];
  trustScore: number | null;
  trustBand: string | null;
  publicationMetrics: ProviderComparisonPublicationMetrics;
  fundingMetrics: ProviderComparisonFundingMetrics;
  trialMetrics: ProviderComparisonTrialMetrics;
  metadata?: Record<string, unknown>;
}

export interface ProviderSpecialtyAlignment {
  dominantSpecialties: string[];
  providerSpecialties: string[];
  overlap: string[];
  alignmentScore: number;
  alignmentLabel: 'ALIGNED' | 'PARTIAL' | 'DIVERGENT' | 'UNKNOWN';
}

export interface ProviderComparisonDelta {
  trustScore: number;
  publicationCount: number;
  fundingTotal: number;
  trialCount: number;
}

export interface ProviderComparisonRow extends ProviderComparisonInput {
  rank: number;
  specialtyAlignment: ProviderSpecialtyAlignment;
  deltasFromCohort: ProviderComparisonDelta;
}

export interface ProviderComparisonSummary {
  dominantSpecialties: string[];
  leaderByTrustScore: string | null;
  leaderByPublications: string | null;
  leaderByFunding: string | null;
  leaderByTrials: string | null;
}

export interface ProviderComparisonResult {
  comparedAt: string;
  npis: string[];
  rows: ProviderComparisonRow[];
  summary: ProviderComparisonSummary;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeSpecialty(value: string): string {
  return normalizeText(value).toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function providerSpecialties(input: ProviderComparisonInput): string[] {
  return uniqueStrings([
    input.primarySpecialty ?? '',
    ...input.secondarySpecialties,
  ].map(normalizeText));
}

function dominantSpecialties(inputs: ProviderComparisonInput[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const input of inputs) {
    for (const specialty of providerSpecialties(input)) {
      const key = normalizeSpecialty(specialty);
      const entry = counts.get(key) ?? { label: specialty, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[1].label.localeCompare(right[1].label))
    .slice(0, 3)
    .map(([, entry]) => entry.label);
}

function buildSpecialtyAlignment(
  input: ProviderComparisonInput,
  cohortDominantSpecialties: string[],
): ProviderSpecialtyAlignment {
  const specialties = providerSpecialties(input);
  if (specialties.length === 0 || cohortDominantSpecialties.length === 0) {
    return {
      dominantSpecialties: [...cohortDominantSpecialties],
      providerSpecialties: specialties,
      overlap: [],
      alignmentScore: 0,
      alignmentLabel: 'UNKNOWN',
    };
  }

  const dominantKeys = new Set(cohortDominantSpecialties.map(normalizeSpecialty));
  const overlap = specialties.filter((specialty) => dominantKeys.has(normalizeSpecialty(specialty)));
  const alignmentScore = round(overlap.length / Math.max(1, cohortDominantSpecialties.length));

  return {
    dominantSpecialties: [...cohortDominantSpecialties],
    providerSpecialties: specialties,
    overlap,
    alignmentScore,
    alignmentLabel:
      alignmentScore >= 0.67
        ? 'ALIGNED'
        : alignmentScore >= 0.34
          ? 'PARTIAL'
          : 'DIVERGENT',
  };
}

function leaderBy(
  inputs: ProviderComparisonInput[],
  selector: (input: ProviderComparisonInput) => number,
): string | null {
  return [...inputs]
    .sort((left, right) => {
      const delta = selector(right) - selector(left);
      if (delta !== 0) {
        return delta;
      }

      return left.providerName.localeCompare(right.providerName);
    })[0]?.npi ?? null;
}

export function buildProviderComparison(
  inputs: ProviderComparisonInput[],
  comparedAt: string = new Date().toISOString(),
): ProviderComparisonResult {
  const dominant = dominantSpecialties(inputs);
  const trustAverage = average(inputs.map((input) => input.trustScore ?? 0));
  const publicationAverage = average(inputs.map((input) => input.publicationMetrics.totalPublications));
  const fundingAverage = average(inputs.map((input) => input.fundingMetrics.totalIndustryPayments));
  const trialAverage = average(inputs.map((input) => input.trialMetrics.totalTrials));

  const rows = [...inputs]
    .map((input) => ({
      ...input,
      specialtyAlignment: buildSpecialtyAlignment(input, dominant),
      deltasFromCohort: {
        trustScore: round((input.trustScore ?? 0) - trustAverage),
        publicationCount: round(input.publicationMetrics.totalPublications - publicationAverage),
        fundingTotal: round(input.fundingMetrics.totalIndustryPayments - fundingAverage),
        trialCount: round(input.trialMetrics.totalTrials - trialAverage),
      },
      rank: 0,
    }))
    .sort((left, right) => {
      const trustDelta = (right.trustScore ?? -1) - (left.trustScore ?? -1);
      if (trustDelta !== 0) {
        return trustDelta;
      }

      const publicationDelta =
        right.publicationMetrics.totalPublications - left.publicationMetrics.totalPublications;
      if (publicationDelta !== 0) {
        return publicationDelta;
      }

      const trialDelta = right.trialMetrics.totalTrials - left.trialMetrics.totalTrials;
      if (trialDelta !== 0) {
        return trialDelta;
      }

      return left.providerName.localeCompare(right.providerName);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return {
    comparedAt,
    npis: rows.map((row) => row.npi),
    rows,
    summary: {
      dominantSpecialties: dominant,
      leaderByTrustScore: leaderBy(inputs, (input) => input.trustScore ?? 0),
      leaderByPublications: leaderBy(inputs, (input) => input.publicationMetrics.totalPublications),
      leaderByFunding: leaderBy(inputs, (input) => input.fundingMetrics.totalIndustryPayments),
      leaderByTrials: leaderBy(inputs, (input) => input.trialMetrics.totalTrials),
    },
  };
}
