import { DomainError } from '../../domain-common/src/errors/DomainError';
import { RecognitionEvent } from '../events/RecognitionEvent';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertCanAccept(
  recognition: RecognitionEvent | null | undefined,
): asserts recognition is RecognitionEvent {
  if (!recognition) {
    throw new DomainError('Recognition is required before acceptance', 'MISSING_RECOGNITION');
  }

  if (
    !recognition.verification ||
    !isNonEmptyString(recognition.verification.verifiedAt) ||
    !isNonEmptyString(recognition.verification.verificationRef)
  ) {
    throw new DomainError(
      'Recognition verification is required before acceptance',
      'MISSING_VERIFICATION',
    );
  }

  if (recognition.expiresAt) {
    const expiresAt = Date.parse(recognition.expiresAt);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      throw new DomainError('Recognition is expired and cannot be accepted', 'RECOGNITION_EXPIRED');
    }
  }

  if (recognition.revocation) {
    throw new DomainError('Recognition has been revoked', 'RECOGNITION_REVOKED');
  }
}
