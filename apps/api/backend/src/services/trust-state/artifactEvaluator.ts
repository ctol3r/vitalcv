import { getIssuer } from '../registry/trustRegistry';
import { determineFreshnessWindowValidity } from './freshnessEvaluator';
import {
  isUnmappedRequirementKey,
  matchesCanonicalArtifactKey,
  normalizeTrustText,
  resolveSourceTrustedIssuerId,
} from './policyMatrix';
import { evaluateRevocationState } from './revocationHandler';
import type {
  ArtifactEvaluationContext,
  ArtifactEvaluationResult,
  ArtifactScore,
  CandidateCredentialRecord,
  TrustReadinessLevel,
  VerificationArtifactRecord,
} from './types';

const POSITIVE_GENERIC_STATUSES = new Set([
  'ACTIVE',
  'VERIFIED',
  'APPROVED',
  'COMPLETE',
  'COMPLIANT',
  'CURRENT',
  'VALID',
  'CLEAR',
]);

const POSITIVE_CLEARANCE_STATUSES = new Set([
  'ACTIVE',
  'VERIFIED',
  'APPROVED',
  'COMPLETE',
  'COMPLIANT',
  'CURRENT',
  'VALID',
  'CLEAR',
  'NO_MATCH',
  'PASS',
]);

const INDETERMINATE_STATUSES = new Set([
  'ERROR',
  'IN_PROGRESS',
  'NEEDS_REVIEW',
  'PENDING',
  'REVIEW',
  'SUBMITTED',
  'UNKNOWN',
]);

const NEGATIVE_STATUSES = new Set([
  'BLOCKED',
  'DENIED',
  'FAILED',
  'INVALID',
  'MISSING',
  'NOT_FOUND',
]);

const NEGATIVE_CLEARANCE_STATUSES = new Set([
  'BLOCKED',
  'DENIED',
  'EXCLUDED',
  'FAILED',
  'FLAGGED',
  'HIT',
  'MATCH',
  'NOT_CLEAR',
  'SANCTIONED',
]);

type VerificationResultCandidate = {
  level: TrustReadinessLevel;
  revoked: boolean;
  freshness: ArtifactEvaluationResult['freshness'];
  reasons: string[];
  warnings: string[];
  matchedEvidenceIds: string[];
};

function uniqSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function artifactScoreForLevel(level: TrustReadinessLevel, revoked: boolean): ArtifactScore {
  if (revoked || level === 'L0') {
    return 0;
  }
  if (level === 'L1') {
    return 40;
  }
  if (level === 'L2') {
    return 75;
  }
  return 100;
}

function levelPriority(level: TrustReadinessLevel): number {
  if (level === 'L3') {
    return 3;
  }
  if (level === 'L2') {
    return 2;
  }
  if (level === 'L1') {
    return 1;
  }
  return 0;
}

function freshnessPriority(freshness: ArtifactEvaluationResult['freshness']): number {
  if (freshness === 'current') {
    return 3;
  }
  if (freshness === 'not_applicable') {
    return 2;
  }
  if (freshness === 'stale') {
    return 1;
  }
  return 0;
}

function buildEvidenceSearchText(value: unknown): string {
  return normalizeTrustText(JSON.stringify(value ?? {}));
}

function matchesRequirementText(canonicalArtifactKey: string, text: string): boolean {
  if (isUnmappedRequirementKey(canonicalArtifactKey)) {
    return false;
  }

  return matchesCanonicalArtifactKey(canonicalArtifactKey as never, text);
}

function collectCandidateMatches(
  requirementKey: string,
  candidateCredentials: readonly CandidateCredentialRecord[],
): CandidateCredentialRecord[] {
  return candidateCredentials.filter((credential) => {
    const searchText = buildEvidenceSearchText({
      status: credential.status,
      data: credential.data,
    });
    return matchesRequirementText(requirementKey, searchText);
  });
}

function collectVerificationMatches(
  requirementKey: string,
  verificationArtifacts: readonly VerificationArtifactRecord[],
): VerificationArtifactRecord[] {
  return verificationArtifacts.filter((artifact) => {
    const searchText = buildEvidenceSearchText({
      source: artifact.source,
      status: artifact.status,
      rawPayload: artifact.rawPayload,
    });
    return matchesRequirementText(requirementKey, searchText);
  });
}

function isClearanceRequirement(canonicalArtifactKey: string): boolean {
  return canonicalArtifactKey === 'sanctions_clear'
    || canonicalArtifactKey === 'npdb_clear'
    || canonicalArtifactKey === 'background_check';
}

function classifyVerificationStatus(
  canonicalArtifactKey: string,
  status: string,
): 'positive' | 'indeterminate' | 'negative' {
  const normalized = normalizeTrustText(status).replace(/\s+/g, '_').toUpperCase();
  const positiveStatuses = isClearanceRequirement(canonicalArtifactKey)
    ? POSITIVE_CLEARANCE_STATUSES
    : POSITIVE_GENERIC_STATUSES;
  const negativeStatuses = isClearanceRequirement(canonicalArtifactKey)
    ? NEGATIVE_CLEARANCE_STATUSES
    : NEGATIVE_STATUSES;

  if (positiveStatuses.has(normalized)) {
    return 'positive';
  }

  if (negativeStatuses.has(normalized)) {
    return 'negative';
  }

  if (INDETERMINATE_STATUSES.has(normalized)) {
    return 'indeterminate';
  }

  return 'indeterminate';
}

function evaluateIssuerTrust(source: string): { capped: boolean; reason?: string } {
  const issuerId = resolveSourceTrustedIssuerId(source);
  if (!issuerId) {
    return {
      capped: true,
      reason: `issuer trust for source "${source}" is unresolved`,
    };
  }

  const issuer = getIssuer(issuerId);
  if (!issuer) {
    return {
      capped: true,
      reason: `issuer trust for source "${source}" is not registered`,
    };
  }

  if (issuer.status !== 'ACTIVE') {
    return {
      capped: true,
      reason: `issuer ${issuer.issuerName} is not active`,
    };
  }

  if (issuer.trustLevel === 'PROVISIONAL' || issuer.trustLevel === 'UNTRUSTED') {
    return {
      capped: true,
      reason: `issuer ${issuer.issuerName} trust level ${issuer.trustLevel} caps evidence at L2`,
    };
  }

  return { capped: false };
}

function evaluateVerificationArtifactMatch(
  canonicalArtifactKey: string,
  artifact: VerificationArtifactRecord,
  now: Date,
): VerificationResultCandidate {
  const revocation = evaluateRevocationState(artifact);
  const matchedEvidenceIds = [artifact.id];
  if (revocation.revoked) {
    return {
      level: 'L0',
      revoked: true,
      freshness: 'current',
      reasons: revocation.reasons,
      warnings: [`Requirement evidence from ${artifact.source} is revoked or suspended.`],
      matchedEvidenceIds,
    };
  }

  const statusClassification = classifyVerificationStatus(canonicalArtifactKey, artifact.status);
  if (statusClassification === 'negative') {
    return {
      level: 'L0',
      revoked: false,
      freshness: 'current',
      reasons: [`artifact status ${artifact.status} does not satisfy the requirement`],
      warnings: [],
      matchedEvidenceIds,
    };
  }

  const freshness = determineFreshnessWindowValidity({
    canonicalArtifactKey,
    verifiedAt: artifact.verifiedAt,
    expiresAt: artifact.expiresAt,
    psvWindowDeadline: artifact.psvWindowDeadline,
    psvWindowCompliant: artifact.psvWindowCompliant,
    now,
  });

  let level: TrustReadinessLevel = statusClassification === 'positive' ? 'L3' : 'L2';
  const reasons = statusClassification === 'positive'
    ? ['primary-source verification is current']
    : ['verification artifact exists but remains incomplete or under review'];
  const warnings: string[] = [];

  if (!freshness.valid && level === 'L3') {
    level = 'L2';
  }

  if (freshness.reasons.length > 0) {
    reasons.push(...freshness.reasons);
    warnings.push(...freshness.reasons.map((reason) => `Requirement evidence is stale: ${reason}.`));
  }

  const issuerTrust = evaluateIssuerTrust(artifact.source);
  if (level === 'L3' && issuerTrust.capped) {
    level = 'L2';
    if (issuerTrust.reason) {
      reasons.push(issuerTrust.reason);
      warnings.push(issuerTrust.reason);
    }
  }

  return {
    level,
    revoked: false,
    freshness: freshness.freshness,
    reasons,
    warnings,
    matchedEvidenceIds,
  };
}

function selectBestVerificationResult(results: readonly VerificationResultCandidate[]): VerificationResultCandidate {
  return [...results].sort((left, right) => {
    const byLevel = levelPriority(right.level) - levelPriority(left.level);
    if (byLevel !== 0) {
      return byLevel;
    }

    const byRevocation = Number(left.revoked) - Number(right.revoked);
    if (byRevocation !== 0) {
      return byRevocation;
    }

    const byFreshness = freshnessPriority(right.freshness) - freshnessPriority(left.freshness);
    if (byFreshness !== 0) {
      return byFreshness;
    }

    return left.matchedEvidenceIds.join(',').localeCompare(right.matchedEvidenceIds.join(','));
  })[0];
}

export function evaluateCredentialArtifact(
  input: ArtifactEvaluationContext,
): ArtifactEvaluationResult {
  const requirementKey = input.requirement.canonicalArtifactKey;

  if (isUnmappedRequirementKey(requirementKey)) {
    return {
      canonicalArtifactKey: requirementKey,
      requirementLabel: input.requirement.requirementLabel,
      requirementWeight: input.requirement.requirementWeight,
      resolvedLevel: 'L0',
      artifactScore: 0,
      revoked: false,
      freshness: 'not_applicable',
      matchedEvidenceIds: [],
      reasons: ['requirement could not be mapped to a canonical artifact key'],
      warnings: [`Requirement "${input.requirement.requirementLabel}" could not be mapped to a canonical artifact key.`],
    };
  }

  if (requirementKey === 'identity_binding' || requirementKey === 'npi_verification') {
    const bindingActive = input.binding?.status === 'ACTIVE';
    const reasons = bindingActive
      ? ['active DID to NPI identity anchor found']
      : ['subject DID does not have an active DID to NPI identity anchor'];
    const warnings = bindingActive
      ? []
      : [`Subject DID does not have an active binding for "${input.requirement.requirementLabel}".`];
    const resolvedLevel: TrustReadinessLevel = bindingActive ? 'L3' : 'L0';
    return {
      canonicalArtifactKey: requirementKey,
      requirementLabel: input.requirement.requirementLabel,
      requirementWeight: input.requirement.requirementWeight,
      resolvedLevel,
      artifactScore: artifactScoreForLevel(resolvedLevel, false),
      revoked: false,
      freshness: 'not_applicable',
      matchedEvidenceIds: bindingActive && input.binding ? [input.binding.id] : [],
      reasons,
      warnings,
    };
  }

  const verificationMatches = collectVerificationMatches(
    requirementKey,
    input.verificationArtifacts,
  );
  const candidateMatches = collectCandidateMatches(
    requirementKey,
    input.candidateCredentials,
  );

  const verificationResults = verificationMatches.map((artifact) => (
    evaluateVerificationArtifactMatch(requirementKey, artifact, input.now)
  ));

  if (verificationResults.length > 0) {
    const bestVerificationResult = selectBestVerificationResult(verificationResults);
    const allMatchedEvidenceIds = uniqSorted([
      ...verificationMatches.map((artifact) => artifact.id),
      ...candidateMatches.map((credential) => credential.id),
    ]);

    return {
      canonicalArtifactKey: requirementKey,
      requirementLabel: input.requirement.requirementLabel,
      requirementWeight: input.requirement.requirementWeight,
      resolvedLevel: bestVerificationResult.level,
      artifactScore: artifactScoreForLevel(
        bestVerificationResult.level,
        bestVerificationResult.revoked,
      ),
      revoked: bestVerificationResult.revoked,
      freshness: bestVerificationResult.freshness,
      matchedEvidenceIds: allMatchedEvidenceIds,
      reasons: bestVerificationResult.reasons,
      warnings: bestVerificationResult.warnings,
    };
  }

  if (candidateMatches.length > 0) {
    return {
      canonicalArtifactKey: requirementKey,
      requirementLabel: input.requirement.requirementLabel,
      requirementWeight: input.requirement.requirementWeight,
      resolvedLevel: 'L1',
      artifactScore: 40,
      revoked: false,
      freshness: 'not_applicable',
      matchedEvidenceIds: uniqSorted(candidateMatches.map((credential) => credential.id)),
      reasons: ['self-asserted credential exists without qualifying primary-source verification'],
      warnings: [],
    };
  }

  return {
    canonicalArtifactKey: requirementKey,
    requirementLabel: input.requirement.requirementLabel,
    requirementWeight: input.requirement.requirementWeight,
    resolvedLevel: 'L0',
    artifactScore: 0,
    revoked: false,
    freshness: 'not_applicable',
    matchedEvidenceIds: [],
    reasons: ['no matching evidence found for the requirement'],
    warnings: [],
  };
}
