import { getFreshnessWindowDays } from './policyMatrix';
import type { FreshnessEvaluation } from './types';

const MS_PER_DAY = 86_400_000;

export function determineFreshnessWindowValidity(input: {
  canonicalArtifactKey: string;
  verifiedAt: Date;
  expiresAt: Date | null;
  psvWindowDeadline: Date | null;
  psvWindowCompliant: boolean | null;
  now: Date;
}): FreshnessEvaluation {
  if (input.canonicalArtifactKey === 'identity_binding' || input.canonicalArtifactKey === 'npi_verification') {
    return {
      freshness: 'not_applicable',
      valid: true,
      reasons: [],
    };
  }

  if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
    return {
      freshness: 'expired',
      valid: false,
      reasons: [`artifact expired at ${input.expiresAt.toISOString()}`],
    };
  }

  if (input.psvWindowCompliant === false) {
    return {
      freshness: 'stale',
      valid: false,
      reasons: ['artifact failed the PSV freshness window'],
    };
  }

  if (
    input.psvWindowDeadline &&
    input.psvWindowDeadline.getTime() < input.now.getTime() &&
    input.psvWindowCompliant !== true
  ) {
    return {
      freshness: 'stale',
      valid: false,
      reasons: ['artifact exceeded the PSV freshness window deadline'],
    };
  }

  const freshnessWindowDays = getFreshnessWindowDays(input.canonicalArtifactKey);
  if (freshnessWindowDays === null) {
    return {
      freshness: 'current',
      valid: true,
      reasons: [],
    };
  }

  const ageInDays = (input.now.getTime() - input.verifiedAt.getTime()) / MS_PER_DAY;
  if (ageInDays > freshnessWindowDays) {
    return {
      freshness: 'stale',
      valid: false,
      reasons: [`artifact is older than the ${freshnessWindowDays}-day freshness window`],
    };
  }

  return {
    freshness: 'current',
    valid: true,
    reasons: [],
  };
}
