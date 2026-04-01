import {
  createCanonicalSourceCoverage,
  findPriorityCanonicalSourceCoverage,
  normalizeCanonicalSourceCoverageState,
  sourceCoverageBadgeLabel as packageSourceCoverageBadgeLabel,
  sourceCoveragePosture,
  sourceCoverageStateLabel as packageSourceCoverageStateLabel,
  type CanonicalSourceCoverage as PassportSourceCoverageCheck,
  type CanonicalSourceCoverageReport as PassportSourceCoverageReport,
  type CanonicalSourceCoverageState as PassportSourceCoverageState,
  type CanonicalSourceCoverageSummary as PassportSourceCoverageSummary,
  type CanonicalSourceProof as PassportSourceCoverageProof,
  type SourceCoveragePosture,
} from '../../../../packages/trust-state';

export type {
  PassportSourceCoverageCheck,
  PassportSourceCoverageProof,
  PassportSourceCoverageReport,
  PassportSourceCoverageState,
  PassportSourceCoverageSummary,
  SourceCoveragePosture,
};

export interface PassportVisibleSourceCoverageCheck extends PassportSourceCoverageCheck {
  sourceLabel: string;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizePassportSourceCoverageState(
  value: unknown,
): PassportSourceCoverageState | null {
  return normalizeCanonicalSourceCoverageState(value);
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

    return [createCanonicalSourceCoverage({
      sourceId,
      state,
      reason,
      checkedAt: toTrimmedString(entry?.checkedAt) ?? null,
      observedAt: toTrimmedString(entry?.observedAt) ?? null,
      expiresAt: toTrimmedString(entry?.expiresAt) ?? null,
      artifactId: toTrimmedString(entry?.artifactId) ?? null,
      sourceUrl: toTrimmedString(entry?.sourceUrl) ?? null,
      rawArtifactRef: toTrimmedString(entry?.rawArtifactRef) ?? null,
      checksum: toTrimmedString(entry?.checksum) ?? null,
      parserVersion: toTrimmedString(entry?.parserVersion) ?? null,
      freshnessWindowHours:
        typeof entry?.freshnessWindowHours === 'number'
        && Number.isFinite(entry.freshnessWindowHours)
          ? entry.freshnessWindowHours
          : null,
      proof: entry?.proof
        ? {
            artifactIds: Array.isArray(entry.proof.artifactIds)
              ? entry.proof.artifactIds.flatMap((value: unknown) => toTrimmedString(value) ?? [])
              : [],
            receiptIds: Array.isArray(entry.proof.receiptIds)
              ? entry.proof.receiptIds.flatMap((value: unknown) => toTrimmedString(value) ?? [])
              : [],
          }
        : null,
    })];
  });
}

function normalizeCoverageSource(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const SOURCE_VISIBILITY_PRIORITY: PassportSourceCoverageState[] = [
  'reviewRequired',
  'stale',
  'checked',
  'accessRequired',
  'gated',
  'pending',
  'unavailable',
  'notDecisionGrade',
  'previewOnly',
];

const SOURCE_VISIBILITY_CONFIG = [
  {
    label: 'NPPES',
    aliases: ['NPPES_API', 'NPPES', 'NPI Registry'],
    fallback: createCanonicalSourceCoverage({
      sourceId: 'NPPES',
      state: 'pending',
      reason: 'NPPES has not been checked yet.',
    }),
  },
  {
    label: 'OIG',
    aliases: ['OIG_LEIE', 'OIG', 'LEIE'],
    fallback: createCanonicalSourceCoverage({
      sourceId: 'OIG',
      state: 'pending',
      reason: 'OIG has not been checked yet.',
    }),
  },
  {
    label: 'PECOS',
    aliases: ['PECOS_PUBLIC', 'PECOS', 'CMS PECOS'],
    fallback: createCanonicalSourceCoverage({
      sourceId: 'PECOS',
      state: 'pending',
      reason: 'PECOS has not been checked yet.',
    }),
  },
  {
    label: 'State Board',
    aliases: ['STATE_BOARD', 'FSMB', 'NURSYS', 'State Board'],
    fallback: createCanonicalSourceCoverage({
      sourceId: 'State Board',
      state: 'accessRequired',
      reason: 'State board access is required before this source can be checked.',
    }),
  },
] as const;

export function findPassportSourceCoverageCheck(
  report: PassportSourceCoverageReport | null | undefined,
  aliases: string[],
): PassportSourceCoverageCheck | null {
  return findPassportSourceCoverageChecks(report, aliases)[0] ?? null;
}

export function findPassportSourceCoverageChecks(
  report: PassportSourceCoverageReport | null | undefined,
  aliases: string[],
): PassportSourceCoverageCheck[] {
  const normalizedAliases = aliases.map((alias) => normalizeCoverageSource(alias));

  return normalizePassportSourceCoverageChecks(report).filter((entry) => {
    const normalizedSource = normalizeCoverageSource(entry.sourceId);

    return normalizedAliases.some((alias) => (
      normalizedSource.includes(alias) || alias.includes(normalizedSource)
    ));
  });
}

export function buildPassportSourceVisibilityChecks(
  checks: readonly PassportSourceCoverageCheck[],
): PassportVisibleSourceCoverageCheck[] {
  return SOURCE_VISIBILITY_CONFIG.map((config) => {
    const aliases = config.aliases.map((alias) => normalizeCoverageSource(alias));
    const matches = checks.filter((entry) => {
      const normalizedSource = normalizeCoverageSource(entry.sourceId);

      return aliases.some((alias) => (
        normalizedSource.includes(alias) || alias.includes(normalizedSource)
      ));
    });
    const selected = matches.length > 0
      ? findPriorityCanonicalSourceCoverage(matches, SOURCE_VISIBILITY_PRIORITY) ?? matches[0]
      : config.fallback;

    return {
      ...selected,
      sourceId: config.label,
      sourceLabel: config.label,
    };
  });
}

export function sourceVisibilityBadgeLabel(
  state: PassportSourceCoverageState,
): string {
  switch (state) {
    case 'checked':
      return 'Checked';
    case 'stale':
      return 'Stale';
    case 'gated':
    case 'accessRequired':
      return 'Access required';
    case 'reviewRequired':
      return 'Needs review';
    case 'unavailable':
    case 'notDecisionGrade':
    case 'previewOnly':
      return 'Missing data';
    case 'pending':
    default:
      return 'Pending';
  }
}

export function sourceCoverageBadgeLabel(input: {
  state: PassportSourceCoverageState;
  decisionGrade: boolean;
}): string {
  if (input.state === 'reviewRequired') {
    return 'Needs review';
  }

  if (
    input.state === 'unavailable'
    || input.state === 'notDecisionGrade'
    || input.state === 'previewOnly'
  ) {
    return 'Missing data';
  }

  return packageSourceCoverageBadgeLabel(input);
}

export function sourceCoverageStateLabel(
  state: PassportSourceCoverageState,
): string {
  if (state === 'reviewRequired') {
    return 'Needs review';
  }

  if (
    state === 'unavailable'
    || state === 'notDecisionGrade'
    || state === 'previewOnly'
  ) {
    return 'Missing data';
  }

  return packageSourceCoverageStateLabel(state);
}

export {
  findPriorityCanonicalSourceCoverage,
  sourceCoveragePosture,
};
