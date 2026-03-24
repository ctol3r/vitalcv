import {
  createCanonicalSourceCoverage,
  normalizeCanonicalSourceCoverageState,
  sourceCoverageBadgeLabel,
  sourceCoveragePosture,
  sourceCoverageStateLabel,
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
      artifactId: toTrimmedString(entry?.artifactId) ?? null,
      sourceUrl: toTrimmedString(entry?.sourceUrl) ?? null,
      rawArtifactRef: toTrimmedString(entry?.rawArtifactRef) ?? null,
      checksum: toTrimmedString(entry?.checksum) ?? null,
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

export {
  sourceCoverageBadgeLabel,
  sourceCoveragePosture,
  sourceCoverageStateLabel,
};
