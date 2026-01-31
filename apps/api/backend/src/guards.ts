
export class CanonicalPathViolation extends Error {
  constructor(message: string, public readonly violationType: string, public readonly context?: any) {
    super(message);
    this.name = 'CanonicalPathViolation';
  }
}

function assertDidPresent(did: any, fieldName: string) {
  if (!did || typeof did !== 'string' || did.trim().length === 0) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid DID`, 'INVALID_SIGNATURE', { fieldName, did });
  }
}

function assertTimestampValid(timestamp: any, fieldName: string) {
  if (!timestamp || typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid ISO 8601 timestamp`, 'TIMESTAMP_ORDER', { fieldName, timestamp });
  }
}

function assertProofValid(proof: any, eventType: string) {
  if (!proof || !proof.type || !proof.verificationMethod || !proof.proofValue) {
    throw new CanonicalPathViolation(`${eventType} proof missing required fields`, 'INVALID_SIGNATURE', { eventType });
  }
}

export function assertCanonicalPathValid(path: any): void {
  if (!path.recognition || !path.acceptance || !path.start) {
    throw new CanonicalPathViolation('Canonical path requires Recognition, Acceptance, and Start events', 'MISSING_EVENT');
  }

  const { recognition, acceptance, start } = path;

  // Validate Recognition
  assertDidPresent(recognition.employerDid, 'Recognition.employerDid');
  assertDidPresent(recognition.practitionerDid, 'Recognition.practitionerDid');
  assertTimestampValid(recognition.recognizedAt, 'Recognition.recognizedAt');
  assertProofValid(recognition.proof, 'Recognition');

  // Validate Acceptance
  if (acceptance.recognitionId !== recognition.recognitionId) throw new CanonicalPathViolation('Acceptance must reference Recognition', 'MISSING_REFERENCE');
  assertDidPresent(acceptance.employerDid, 'Acceptance.employerDid');
  assertTimestampValid(acceptance.acceptedAt, 'Acceptance.acceptedAt');

  if (new Date(acceptance.acceptedAt).getTime() < new Date(recognition.recognizedAt).getTime()) {
    throw new CanonicalPathViolation('Acceptance cannot precede Recognition', 'TIMESTAMP_ORDER');
  }

  // Validate Start
  if (start.recognitionId !== recognition.recognitionId) throw new CanonicalPathViolation('Start must reference Recognition', 'MISSING_REFERENCE');
  if (start.acceptanceId !== acceptance.acceptanceId) throw new CanonicalPathViolation('Start must reference Acceptance', 'MISSING_REFERENCE');
  assertTimestampValid(start.actualStartDate, 'Start.actualStartDate');

  if (new Date(start.actualStartDate).getTime() < new Date(acceptance.acceptedAt).getTime()) {
    throw new CanonicalPathViolation('Start date cannot precede Acceptance', 'TIMESTAMP_ORDER');
  }
}
