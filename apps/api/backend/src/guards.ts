export class CanonicalPathViolation extends Error {
  constructor(
    message: string,
    public readonly violationType: string,
    public readonly context?: Record<string, unknown>,
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

type CanonicalVerification = {
  verifiedAt?: string;
  verificationRef?: string;
};

type CanonicalRecognition = {
  recognitionId?: string;
  employerDid?: string;
  practitionerDid?: string;
  roleId?: string;
  recognizedAt?: string;
  verification?: CanonicalVerification;
  proof?: CanonicalProof;
  hashAnchor?: string;
  terms?: {
    expiresAt?: string;
  };
};

type CanonicalAcceptance = {
  acceptanceId?: string;
  recognitionId?: string;
  employerDid?: string;
  practitionerDid?: string;
  roleId?: string;
  facilityId?: string;
  acceptedAt?: string;
  countersignedAt?: string;
  practitionerProof?: CanonicalProof;
  employerProof?: CanonicalProof;
  hashAnchor?: string;
  psvReportId?: string;
};

type CanonicalStart = {
  attestationId?: string;
  recognitionId?: string;
  acceptanceId?: string;
  employerDid?: string;
  practitionerDid?: string;
  roleId?: string;
  facilityId?: string;
  actualStartDate?: string;
  attestedAt?: string;
  proof?: CanonicalProof;
  hashAnchor?: string;
};

type CanonicalPath = {
  recognition?: CanonicalRecognition;
  acceptance?: CanonicalAcceptance;
  start?: CanonicalStart;
};

const VALID_PROOF_TYPES = new Set(['Ed25519Signature2020', 'JcsEd25519Signature2020']);

function assertStringPresent(value: unknown, fieldName: string): asserts value is string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid string`, 'INVALID_SIGNATURE', {
      fieldName,
      value,
    });
  }
}

function assertDidPresent(did: unknown, fieldName: string): asserts did is string {
  if (!did || typeof did !== 'string' || did.trim().length === 0) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid DID`, 'INVALID_SIGNATURE', {
      fieldName,
      did,
    });
  }
}

function assertTimestampValid(timestamp: unknown, fieldName: string): asserts timestamp is string {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new CanonicalPathViolation(
      `${fieldName} must be a valid ISO 8601 timestamp`,
      'TIMESTAMP_ORDER',
      {
        fieldName,
        timestamp,
      },
    );
  }

  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoRegex.test(timestamp)) {
    throw new CanonicalPathViolation(
      `${fieldName} must be a valid ISO 8601 timestamp`,
      'TIMESTAMP_ORDER',
      {
        fieldName,
        timestamp,
      },
    );
  }
}

function assertProofValid(proof: unknown, eventType: string): asserts proof is CanonicalProof {
  if (!proof || typeof proof !== 'object') {
    throw new CanonicalPathViolation(
      `${eventType} proof missing required fields`,
      'INVALID_SIGNATURE',
      {
        eventType,
      },
    );
  }

  const { type, verificationMethod, proofValue } = proof as CanonicalProof;
  if (!type || !verificationMethod || !proofValue) {
    throw new CanonicalPathViolation(
      `${eventType} proof missing required fields`,
      'INVALID_SIGNATURE',
      {
        eventType,
      },
    );
  }

  if (!VALID_PROOF_TYPES.has(type)) {
    throw new CanonicalPathViolation(
      `${eventType} proof type must be Ed25519Signature2020 or JcsEd25519Signature2020`,
      'INVALID_PROOF_TYPE',
      {
        eventType,
        proofType: type,
      },
    );
  }
}

function assertVerificationValid(
  verification: unknown,
): asserts verification is CanonicalVerification {
  if (!verification || typeof verification !== 'object') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.verification must be present',
      'INVALID_SIGNATURE',
      {
        verification,
      },
    );
  }

  const { verifiedAt, verificationRef } = verification as CanonicalVerification;
  assertTimestampValid(verifiedAt, 'RecognitionEvent.verification.verifiedAt');
  assertStringPresent(verificationRef, 'RecognitionEvent.verification.verificationRef');
}

export function assertRecognitionEventValid(event: CanonicalRecognition): void {
  assertDidPresent(event.employerDid, 'RecognitionEvent.employerDid');
  assertDidPresent(event.practitionerDid, 'RecognitionEvent.practitionerDid');
  assertStringPresent(event.recognitionId, 'RecognitionEvent.recognitionId');
  assertStringPresent(event.roleId, 'RecognitionEvent.roleId');

  assertProofValid(event.proof, 'RecognitionEvent');

  if (!event.proof?.verificationMethod?.includes(event.employerDid || '')) {
    throw new CanonicalPathViolation(
      'RecognitionEvent proof verificationMethod must reference employerDid',
      'SELF_REPORTED',
      {
        verificationMethod: event.proof?.verificationMethod,
        employerDid: event.employerDid,
      },
    );
  }

  assertTimestampValid(event.recognizedAt, 'RecognitionEvent.recognizedAt');

  assertVerificationValid(event.verification);
  if (
    new Date(event.verification.verifiedAt as string).getTime() >
    new Date(event.recognizedAt as string).getTime()
  ) {
    throw new CanonicalPathViolation(
      'RecognitionEvent.verification.verifiedAt must be at or before recognizedAt',
      'TIMESTAMP_ORDER',
      {
        verifiedAt: event.verification.verifiedAt,
        recognizedAt: event.recognizedAt,
      },
    );
  }

  assertStringPresent(event.hashAnchor, 'RecognitionEvent.hashAnchor');
}

export function assertEmployerAcceptanceValid(
  acceptance: CanonicalAcceptance,
  recognition: CanonicalRecognition,
): void {
  if (!acceptance.recognitionId || acceptance.recognitionId !== recognition.recognitionId) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance must reference valid RecognitionEvent.recognitionId',
      'MISSING_REFERENCE',
      {
        acceptanceRecognitionId: acceptance.recognitionId,
        expectedRecognitionId: recognition.recognitionId,
      },
    );
  }

  assertDidPresent(acceptance.employerDid, 'EmployerAcceptance.employerDid');
  assertDidPresent(acceptance.practitionerDid, 'EmployerAcceptance.practitionerDid');

  if (acceptance.employerDid !== recognition.employerDid) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.employerDid must match RecognitionEvent.employerDid',
      'DID_MISMATCH',
      {
        acceptanceEmployerDid: acceptance.employerDid,
        recognitionEmployerDid: recognition.employerDid,
      },
    );
  }

  if (acceptance.practitionerDid !== recognition.practitionerDid) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.practitionerDid must match RecognitionEvent.practitionerDid',
      'DID_MISMATCH',
      {
        acceptancePractitionerDid: acceptance.practitionerDid,
        recognitionPractitionerDid: recognition.practitionerDid,
      },
    );
  }

  if (acceptance.roleId !== recognition.roleId) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.roleId must match RecognitionEvent.roleId',
      'DID_MISMATCH',
      {
        acceptanceRoleId: acceptance.roleId,
        recognitionRoleId: recognition.roleId,
      },
    );
  }

  assertStringPresent(acceptance.facilityId, 'EmployerAcceptance.facilityId');

  assertProofValid(acceptance.practitionerProof, 'EmployerAcceptance.practitionerProof');
  if (
    !acceptance.practitionerProof?.verificationMethod?.includes(acceptance.practitionerDid || '')
  ) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance practitionerProof must reference practitionerDid',
      'INVALID_SIGNATURE',
      {
        verificationMethod: acceptance.practitionerProof?.verificationMethod,
        practitionerDid: acceptance.practitionerDid,
      },
    );
  }

  assertProofValid(acceptance.employerProof, 'EmployerAcceptance.employerProof');
  if (!acceptance.employerProof?.verificationMethod?.includes(acceptance.employerDid || '')) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance employerProof must reference employerDid',
      'MISSING_COUNTERSIGNATURE',
      {
        verificationMethod: acceptance.employerProof?.verificationMethod,
        employerDid: acceptance.employerDid,
      },
    );
  }

  assertTimestampValid(acceptance.acceptedAt, 'EmployerAcceptance.acceptedAt');
  assertTimestampValid(acceptance.countersignedAt, 'EmployerAcceptance.countersignedAt');

  const recognitionTime = new Date(recognition.recognizedAt as string).getTime();
  const acceptedTime = new Date(acceptance.acceptedAt as string).getTime();
  const countersignedTime = new Date(acceptance.countersignedAt as string).getTime();

  if (acceptedTime < recognitionTime) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.acceptedAt must be after RecognitionEvent.recognizedAt',
      'TIMESTAMP_ORDER',
      {
        recognizedAt: recognition.recognizedAt,
        acceptedAt: acceptance.acceptedAt,
      },
    );
  }

  if (countersignedTime < acceptedTime) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.countersignedAt must be after acceptedAt',
      'TIMESTAMP_ORDER',
      {
        acceptedAt: acceptance.acceptedAt,
        countersignedAt: acceptance.countersignedAt,
      },
    );
  }

  if (recognition.terms?.expiresAt) {
    assertTimestampValid(recognition.terms.expiresAt, 'RecognitionEvent.terms.expiresAt');
    const expiresTime = new Date(recognition.terms.expiresAt).getTime();
    if (acceptedTime > expiresTime) {
      throw new CanonicalPathViolation(
        'RecognitionEvent is expired and cannot be accepted',
        'EXPIRED',
        {
          expiresAt: recognition.terms.expiresAt,
          acceptedAt: acceptance.acceptedAt,
        },
      );
    }
  }

  assertStringPresent(acceptance.hashAnchor, 'EmployerAcceptance.hashAnchor');
  assertStringPresent(acceptance.psvReportId, 'EmployerAcceptance.psvReportId');
}

export function assertStartAttestationValid(
  start: CanonicalStart,
  recognition: CanonicalRecognition,
  acceptance: CanonicalAcceptance,
): void {
  if (!start.recognitionId || start.recognitionId !== recognition.recognitionId) {
    throw new CanonicalPathViolation(
      'StartAttestation must reference valid RecognitionEvent.recognitionId',
      'MISSING_REFERENCE',
      {
        startRecognitionId: start.recognitionId,
        expectedRecognitionId: recognition.recognitionId,
      },
    );
  }

  if (!start.acceptanceId || start.acceptanceId !== acceptance.acceptanceId) {
    throw new CanonicalPathViolation(
      'StartAttestation must reference valid EmployerAcceptance.acceptanceId',
      'MISSING_REFERENCE',
      {
        startAcceptanceId: start.acceptanceId,
        expectedAcceptanceId: acceptance.acceptanceId,
      },
    );
  }

  assertDidPresent(start.employerDid, 'StartAttestation.employerDid');
  assertDidPresent(start.practitionerDid, 'StartAttestation.practitionerDid');

  if (start.employerDid !== recognition.employerDid) {
    throw new CanonicalPathViolation(
      'StartAttestation.employerDid must match RecognitionEvent.employerDid',
      'DID_MISMATCH',
      {
        startEmployerDid: start.employerDid,
        recognitionEmployerDid: recognition.employerDid,
      },
    );
  }

  if (start.practitionerDid !== recognition.practitionerDid) {
    throw new CanonicalPathViolation(
      'StartAttestation.practitionerDid must match RecognitionEvent.practitionerDid',
      'DID_MISMATCH',
      {
        startPractitionerDid: start.practitionerDid,
        recognitionPractitionerDid: recognition.practitionerDid,
      },
    );
  }

  if (start.roleId !== recognition.roleId) {
    throw new CanonicalPathViolation(
      'StartAttestation.roleId must match RecognitionEvent.roleId',
      'DID_MISMATCH',
      {
        startRoleId: start.roleId,
        recognitionRoleId: recognition.roleId,
      },
    );
  }

  assertStringPresent(start.facilityId, 'StartAttestation.facilityId');
  if (start.facilityId !== acceptance.facilityId) {
    throw new CanonicalPathViolation(
      'StartAttestation.facilityId must match EmployerAcceptance.facilityId',
      'SCOPE_MISMATCH',
      {
        startFacilityId: start.facilityId,
        acceptanceFacilityId: acceptance.facilityId,
      },
    );
  }

  assertProofValid(start.proof, 'StartAttestation');
  if (!start.proof?.verificationMethod?.includes(start.employerDid || '')) {
    throw new CanonicalPathViolation(
      'StartAttestation proof must reference employerDid (cannot be self-reported)',
      'SELF_REPORTED',
      {
        verificationMethod: start.proof?.verificationMethod,
        employerDid: start.employerDid,
      },
    );
  }

  assertTimestampValid(start.actualStartDate, 'StartAttestation.actualStartDate');
  assertTimestampValid(start.attestedAt, 'StartAttestation.attestedAt');

  const acceptedTime = new Date(acceptance.acceptedAt as string).getTime();
  const startTime = new Date(start.actualStartDate as string).getTime();

  if (startTime < acceptedTime) {
    throw new CanonicalPathViolation(
      'StartAttestation.actualStartDate must be at or after EmployerAcceptance.acceptedAt',
      'TIMESTAMP_ORDER',
      {
        acceptedAt: acceptance.acceptedAt,
        actualStartDate: start.actualStartDate,
      },
    );
  }

  assertStringPresent(start.hashAnchor, 'StartAttestation.hashAnchor');
}

export function assertCanonicalPathValid(path: unknown): void {
  if (!path || typeof path !== 'object') {
    throw new CanonicalPathViolation(
      'Canonical path requires Recognition, Acceptance, and Start events',
      'MISSING_EVENT',
    );
  }

  const candidate = path as CanonicalPath;
  if (!candidate.recognition || !candidate.acceptance || !candidate.start) {
    throw new CanonicalPathViolation(
      'Canonical path requires Recognition, Acceptance, and Start events',
      'MISSING_EVENT',
    );
  }

  const { recognition, acceptance, start } = candidate;
  assertRecognitionEventValid(recognition);
  assertEmployerAcceptanceValid(acceptance, recognition);
  assertStartAttestationValid(start, recognition, acceptance);
}
