/**
 * CRS -> readiness signal mapping.
 */

import type { CRSResult, ReadinessSignal } from './types';
import { CRSReasonCode, ReadinessInvariantError } from './types';

const BLOCKING_CODES = new Set<CRSReasonCode>([
  CRSReasonCode.CREDENTIAL_REVOKED,
  CRSReasonCode.CREDENTIAL_EXPIRED,
  CRSReasonCode.CREDENTIAL_NOT_YET_VALID,
  CRSReasonCode.AUTHORITY_REVOKED,
  CRSReasonCode.AUTHORITY_EXPIRED,
  CRSReasonCode.AUTHORITY_PENDING,
  CRSReasonCode.QIA_INVALID,
]);

function assertValidCrsResult(result: CRSResult): void {
  if (!result) {
    throw new ReadinessInvariantError('crsResult is required');
  }
  if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) {
    throw new ReadinessInvariantError('crsResult.score must be between 0 and 100');
  }
  if (result.grade !== 'GREEN' && result.grade !== 'YELLOW' && result.grade !== 'RED') {
    throw new ReadinessInvariantError('crsResult.grade must be RED, YELLOW, or GREEN');
  }
  if (!Array.isArray(result.reasons)) {
    throw new ReadinessInvariantError('crsResult.reasons must be an array');
  }
  for (const reason of result.reasons) {
    if (!reason) {
      throw new ReadinessInvariantError('crsResult.reasons must not include empty entries');
    }
    if (!Object.values(CRSReasonCode).includes(reason.code)) {
      throw new ReadinessInvariantError(`Unsupported reason code: ${reason.code}`);
    }
    if (typeof reason.message !== 'string' || reason.message.trim().length === 0) {
      throw new ReadinessInvariantError('crsResult.reasons.message must be a non-empty string');
    }
    if (!Number.isFinite(reason.deduction) || reason.deduction < 0) {
      throw new ReadinessInvariantError('crsResult.reasons.deduction must be non-negative');
    }
  }
}

export function computeReadinessSignal(crsResult: CRSResult): ReadinessSignal {
  assertValidCrsResult(crsResult);

  const blockers = Array.from(
    new Set(
      crsResult.reasons
        .filter((reason) => BLOCKING_CODES.has(reason.code))
        .map((reason) => reason.code),
    ),
  );

  return {
    greenlight: blockers.length === 0 && crsResult.grade === 'GREEN',
    blockers,
  };
}
