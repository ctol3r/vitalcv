export const PASSPORT_SOURCE_COVERAGE_STATES = [
  'live',
  'gated',
  'partial',
  'stale',
  'notDecisionGrade',
  'notChecked',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  'mock',
] as const;

export type PassportSourceCoverageState =
  (typeof PASSPORT_SOURCE_COVERAGE_STATES)[number];

export type PassportSourceCoverageProof = {
  artifactIds: string[];
  receiptIds: string[];
};

export type PassportSourceCoverageCheck = {
  sourceId: string;
  state: PassportSourceCoverageState;
  reason: string;
  checkedAt?: string | null;
  artifactId?: string | null;
  sourceUrl?: string | null;
  rawArtifactRef?: string | null;
  checksum?: string | null;
  proof?: PassportSourceCoverageProof;
};

export type PassportSourceCoverageSummary = {
  live: string[];
  gated: string[];
  partial: string[];
  stale: string[];
  notDecisionGrade: string[];
  notChecked: string[];
  unavailable: string[];
  accessRequired: string[];
  reviewRequired: string[];
};

export type PassportSourceCoverageReport = {
  checks: PassportSourceCoverageCheck[];
  summary: PassportSourceCoverageSummary;
};

export type SourceCoveragePosture = 'current' | 'partial' | 'degraded';

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizePassportSourceCoverageState(
  value: unknown,
): PassportSourceCoverageState | null {
  const normalized = toTrimmedString(value)
    ?.toLowerCase()
    .replace(/[_\s-]+/g, '');

  switch (normalized) {
    case 'live':
      return 'live';
    case 'gated':
      return 'gated';
    case 'partial':
      return 'partial';
    case 'stale':
      return 'stale';
    case 'notdecisiongrade':
      return 'notDecisionGrade';
    case 'notchecked':
      return 'notChecked';
    case 'unavailable':
      return 'unavailable';
    case 'accessrequired':
      return 'accessRequired';
    case 'reviewrequired':
      return 'reviewRequired';
    case 'mock':
      return 'mock';
    default:
      return null;
  }
}

export function normalizePassportSourceCoverageChecks(
  report: PassportSourceCoverageReport | null | undefined,
): PassportSourceCoverageCheck[] {
  const checks = Array.isArray(report?.checks) ? report.checks : [];

  return checks.flatMap((entry) => {
    const sourceId = toTrimmedString(entry?.sourceId);
    const state = normalizePassportSourceCoverageState(entry?.state);
    const reason = toTrimmedString(entry?.reason);

    if (!sourceId || !state || !reason) {
      return [];
    }

    return [{
      sourceId,
      state,
      reason,
      checkedAt: toTrimmedString(entry?.checkedAt) ?? null,
      artifactId: toTrimmedString(entry?.artifactId) ?? null,
      sourceUrl: toTrimmedString(entry?.sourceUrl) ?? null,
      rawArtifactRef: toTrimmedString(entry?.rawArtifactRef) ?? null,
      checksum: toTrimmedString(entry?.checksum) ?? null,
      ...(entry?.proof
        ? {
            proof: {
              artifactIds: Array.isArray(entry.proof.artifactIds)
                ? entry.proof.artifactIds.flatMap((value) => toTrimmedString(value) ?? [])
                : [],
              receiptIds: Array.isArray(entry.proof.receiptIds)
                ? entry.proof.receiptIds.flatMap((value) => toTrimmedString(value) ?? [])
                : [],
            },
          }
        : {}),
    }];
  });
}

function normalizeCoverageSource(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function findPassportSourceCoverageCheck(
  report: PassportSourceCoverageReport | null | undefined,
  aliases: string[],
): PassportSourceCoverageCheck | null {
  const normalizedAliases = aliases.map((alias) => normalizeCoverageSource(alias));

  return normalizePassportSourceCoverageChecks(report).find((entry) => {
    const normalizedSource = normalizeCoverageSource(entry.sourceId);

    return normalizedAliases.some((alias) => (
      normalizedSource.includes(alias) || alias.includes(normalizedSource)
    ));
  }) ?? null;
}

export function sourceCoverageStateLabel(
  state: PassportSourceCoverageState,
): string {
  switch (state) {
    case 'live':
      return 'Live';
    case 'gated':
      return 'Gated';
    case 'partial':
      return 'Partial coverage';
    case 'stale':
      return 'Stale';
    case 'notDecisionGrade':
      return 'Not decision-grade';
    case 'notChecked':
      return 'Not checked';
    case 'unavailable':
      return 'Unavailable';
    case 'accessRequired':
      return 'Access required';
    case 'reviewRequired':
      return 'Review required';
    case 'mock':
      return 'Demo';
  }
}

export function sourceCoverageBadgeLabel(input: {
  state: PassportSourceCoverageState;
  decisionGrade: boolean;
}): string {
  if (input.state === 'live') {
    return input.decisionGrade ? 'Decision grade' : 'Informational only';
  }

  return sourceCoverageStateLabel(input.state);
}

export function sourceCoveragePosture(
  state: PassportSourceCoverageState,
): SourceCoveragePosture {
  switch (state) {
    case 'live':
      return 'current';
    case 'stale':
    case 'unavailable':
    case 'reviewRequired':
      return 'degraded';
    case 'gated':
    case 'partial':
    case 'notDecisionGrade':
    case 'notChecked':
    case 'accessRequired':
    case 'mock':
      return 'partial';
  }
}
