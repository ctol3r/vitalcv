import { isUnmappedRequirementKey } from './policyMatrix';
import type { ArtifactEvaluationResult, ArtifactStatusEntry } from './types';

function uniqSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function toArtifactStatusEntries(
  evaluations: readonly ArtifactEvaluationResult[],
): ArtifactStatusEntry[] {
  return evaluations.map(({ warnings: _warnings, ...entry }) => ({
    ...entry,
    matchedEvidenceIds: uniqSorted(entry.matchedEvidenceIds),
    reasons: uniqSorted(entry.reasons),
  }));
}

export function buildTrustStateWarnings(
  evaluations: readonly ArtifactEvaluationResult[],
): string[] {
  const warnings: string[] = [];

  for (const evaluation of evaluations) {
    warnings.push(...evaluation.warnings);

    if (isUnmappedRequirementKey(evaluation.canonicalArtifactKey)) {
      warnings.push(`Requirement "${evaluation.requirementLabel}" could not be mapped and was evaluated fail closed.`);
    }

    if (evaluation.revoked) {
      warnings.push(`Requirement "${evaluation.requirementLabel}" is blocked by revoked or suspended evidence.`);
    }

    if (evaluation.freshness === 'expired') {
      warnings.push(`Requirement "${evaluation.requirementLabel}" is expired and requires refresh.`);
    } else if (evaluation.freshness === 'stale') {
      warnings.push(`Requirement "${evaluation.requirementLabel}" is stale and requires refresh.`);
    }
  }

  return uniqSorted(warnings);
}
