
export class CanonicalPathViolation extends Error {
  constructor(
    message: string,
    public readonly violationType: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CanonicalPathViolation';
  }
}

type CanonicalProof = {
  type?: string;
  verificationMethod?: string;
  proofValue?: string;
};

type CanonicalRecognition = {
  recognitionId?: string;
  employerDid?: string;
  practitionerDid?: string;
  recognizedAt?: string;
  proof?: CanonicalProof;
};

type CanonicalAcceptance = {
  acceptanceId?: string;
  recognitionId?: string;
  employerDid?: string;
  acceptedAt?: string;
};

type CanonicalStart = {
  recognitionId?: string;
  acceptanceId?: string;
  actualStartDate?: string;
};

type CanonicalPath = {
  recognition?: CanonicalRecognition;
  acceptance?: CanonicalAcceptance;
  start?: CanonicalStart;
};

function assertDidPresent(did: unknown, fieldName: string): asserts did is string {
  if (!did || typeof did !== 'string' || did.trim().length === 0) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid DID`, 'INVALID_SIGNATURE', { fieldName, did });
  }
}

function assertTimestampValid(timestamp: unknown, fieldName: string): asserts timestamp is string {
  if (!timestamp || typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid ISO 8601 timestamp`, 'TIMESTAMP_ORDER', { fieldName, timestamp });
  }
}

function assertProofValid(proof: unknown, eventType: string): asserts proof is CanonicalProof {
  if (!proof || typeof proof !== 'object') {
    throw new CanonicalPathViolation(`${eventType} proof missing required fields`, 'INVALID_SIGNATURE', { eventType });
  }

  const { type, verificationMethod, proofValue } = proof as CanonicalProof;
  if (!type || !verificationMethod || !proofValue) {
    throw new CanonicalPathViolation(`${eventType} proof missing required fields`, 'INVALID_SIGNATURE', { eventType });
  }
}

export function assertCanonicalPathValid(path: unknown): void {
  if (!path || typeof path !== 'object') {
    throw new CanonicalPathViolation('Canonical path requires Recognition, Acceptance, and Start events', 'MISSING_EVENT');
  }

  const candidate = path as CanonicalPath;
  if (!candidate.recognition || !candidate.acceptance || !candidate.start) {
    throw new CanonicalPathViolation('Canonical path requires Recognition, Acceptance, and Start events', 'MISSING_EVENT');
  }

  const { recognition, acceptance, start } = candidate;

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
