/**
 * Credential Readiness Score (CRS) computation.
 */

import { AuthorityScopeStatus } from '@domain/authority';
import { CredentialStatus } from '@domain/credentials';
import type { CRSGrade, CRSInput, CRSReason, CRSResult } from './types';
import { CRSReasonCode } from './types';
import { decayScore } from './decayModel';
import {
  assertValidCRSInput,
  resolveAuthorityStatus,
  resolveFreshnessAnchor,
} from './invariants';

const BASE_SCORE = 100;
const DEFAULT_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 7;

const DEDUCTIONS = {
  credential: {
    revoked: 100,
    expired: 70,
    notYetValid: 40,
  },
  authority: {
    revoked: 60,
    expired: 50,
    pending: 20,
  },
  qiaInvalid: 50,
  trust: {
    medium: 10,
    low: 25,
  },
};

const GRADE_THRESHOLDS = {
  GREEN: 80,
  YELLOW: 50,
};

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeGrade(score: number): CRSGrade {
  if (score >= GRADE_THRESHOLDS.GREEN) {
    return 'GREEN';
  }
  if (score >= GRADE_THRESHOLDS.YELLOW) {
    return 'YELLOW';
  }
  return 'RED';
}

function addDeduction(
  reasons: CRSReason[],
  code: CRSReasonCode,
  message: string,
  deduction: number,
): number {
  if (deduction <= 0) {
    return 0;
  }
  reasons.push({ code, message, deduction });
  return deduction;
}

export function computeCRS(input: CRSInput, now: Date): CRSResult {
  assertValidCRSInput(input, now);

  let score = BASE_SCORE;
  const reasons: CRSReason[] = [];

  const validity = input.credentialValidityResult;
  switch (validity.status) {
    case CredentialStatus.REVOKED: {
      const detail = validity.revocation?.reason
        ? ` (${validity.revocation.reason})`
        : '';
      const revokedAt = validity.revocation?.revoked_at;
      const message = revokedAt
        ? `Credential revoked at ${revokedAt.toISOString()}${detail}`
        : `Credential revoked${detail}`;
      score -= addDeduction(
        reasons,
        CRSReasonCode.CREDENTIAL_REVOKED,
        message,
        DEDUCTIONS.credential.revoked,
      );
      break;
    }
    case CredentialStatus.EXPIRED: {
      const validUntil = validity.valid_until;
      const suffix = validUntil ? ` at ${validUntil.toISOString()}` : '';
      score -= addDeduction(
        reasons,
        CRSReasonCode.CREDENTIAL_EXPIRED,
        `Credential expired${suffix}`,
        DEDUCTIONS.credential.expired,
      );
      break;
    }
    case CredentialStatus.NOT_YET_VALID: {
      const suffix = validity.reason ? `: ${validity.reason}` : '';
      score -= addDeduction(
        reasons,
        CRSReasonCode.CREDENTIAL_NOT_YET_VALID,
        `Credential not yet valid${suffix}`,
        DEDUCTIONS.credential.notYetValid,
      );
      break;
    }
    case CredentialStatus.VALID:
      break;
    default:
      break;
  }

  const authorityStatus = resolveAuthorityStatus(input.authorityStateSummary);
  switch (authorityStatus) {
    case AuthorityScopeStatus.REVOKED:
      score -= addDeduction(
        reasons,
        CRSReasonCode.AUTHORITY_REVOKED,
        `Authority scope revoked as of ${input.authorityStateSummary.as_of.toISOString()}`,
        DEDUCTIONS.authority.revoked,
      );
      break;
    case AuthorityScopeStatus.EXPIRED:
      score -= addDeduction(
        reasons,
        CRSReasonCode.AUTHORITY_EXPIRED,
        `Authority scope expired as of ${input.authorityStateSummary.as_of.toISOString()}`,
        DEDUCTIONS.authority.expired,
      );
      break;
    case AuthorityScopeStatus.PENDING:
      score -= addDeduction(
        reasons,
        CRSReasonCode.AUTHORITY_PENDING,
        `Authority scope pending as of ${input.authorityStateSummary.as_of.toISOString()}`,
        DEDUCTIONS.authority.pending,
      );
      break;
    case AuthorityScopeStatus.ACTIVE:
      break;
    default:
      break;
  }

  if (input.qiaValidationResult.ok === false) {
    const detail = input.qiaValidationResult.reasons.join('; ');
    score -= addDeduction(
      reasons,
      CRSReasonCode.QIA_INVALID,
      `QIA validation failed: ${detail}`,
      DEDUCTIONS.qiaInvalid,
    );
  }

  const trust = input.trustGradient;
  if (trust.band === 'LOW') {
    score -= addDeduction(
      reasons,
      CRSReasonCode.TRUST_GRADIENT_LOW,
      `Trust gradient LOW (score ${trust.score.toFixed(2)})`,
      DEDUCTIONS.trust.low,
    );
  } else if (trust.band === 'MEDIUM') {
    score -= addDeduction(
      reasons,
      CRSReasonCode.TRUST_GRADIENT_MEDIUM,
      `Trust gradient MEDIUM (score ${trust.score.toFixed(2)})`,
      DEDUCTIONS.trust.medium,
    );
  }

  score = clampScore(score);

  const halfLifeMs = input.decay?.half_life_ms ?? DEFAULT_HALF_LIFE_MS;
  const freshnessAnchor = resolveFreshnessAnchor(input);
  const elapsedMs = now.getTime() - freshnessAnchor.getTime();
  const decayedScore = decayScore(score, elapsedMs, halfLifeMs);
  const finalScore = clampScore(roundScore(decayedScore));

  if (finalScore < score) {
    const deduction = roundScore(score - finalScore);
    if (deduction > 0) {
      addDeduction(
        reasons,
        CRSReasonCode.DECAY_FRESHNESS,
        `Freshness decay applied (elapsed ${Math.round(elapsedMs)}ms, half-life ${Math.round(
          halfLifeMs,
        )}ms)`,
        deduction,
      );
    }
  }

  return {
    score: finalScore,
    grade: computeGrade(finalScore),
    reasons,
  };
}
