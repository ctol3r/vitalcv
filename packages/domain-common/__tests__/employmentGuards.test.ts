import { describe, it, expect } from 'vitest';
import {
  assertCanonicalPathValid,
  assertEmployerAcceptanceValid,
  assertRecognitionEventValid,
  assertStartAttestationValid,
  isCanonicalPathValid,
  verifyCanonicalPath,
  CanonicalPathViolation,
} from '../employmentGuards';
import {
  RecognitionEvent,
  EmployerAcceptance,
  StartAttestation,
  EmploymentVerificationPath,
} from '../employmentContracts';

const createProof = (did: string, created: string) => ({
  type: 'Ed25519Signature2020',
  created,
  verificationMethod: `${did}#key-1`,
  proofPurpose: 'assertionMethod',
  proofValue: `proof-${did}`,
});

const createRecognition = (overrides: Partial<RecognitionEvent> = {}): RecognitionEvent => ({
  recognitionId: 'rec-001',
  employerDid: 'did:example:employer',
  practitionerDid: 'did:example:practitioner',
  roleId: 'role:registered-nurse',
  recognizedAt: '2024-01-01T00:00:00Z',
  proof: createProof('did:example:employer', '2024-01-01T00:00:00Z'),
  hashAnchor: 'hash-recognition',
  ...overrides,
});

const createAcceptance = (
  recognition: RecognitionEvent,
  overrides: Partial<EmployerAcceptance> = {}
): EmployerAcceptance => ({
  acceptanceId: 'acc-001',
  recognitionId: recognition.recognitionId,
  employerDid: recognition.employerDid,
  practitionerDid: recognition.practitionerDid,
  roleId: recognition.roleId,
  acceptedAt: '2024-01-02T00:00:00Z',
  countersignedAt: '2024-01-02T01:00:00Z',
  agreedStartDate: '2024-02-01T00:00:00Z',
  practitionerProof: createProof(recognition.practitionerDid, '2024-01-02T00:00:00Z'),
  employerProof: createProof(recognition.employerDid, '2024-01-02T01:00:00Z'),
  hashAnchor: 'hash-acceptance',
  validity: {
    validFrom: '2024-01-02T00:00:00Z',
    validUntil: '2024-03-01T00:00:00Z',
  },
  terms: {
    roleTitle: 'Registered Nurse',
    schedule: 'full-time',
  },
  ...overrides,
});

const createStart = (
  recognition: RecognitionEvent,
  acceptance: EmployerAcceptance,
  overrides: Partial<StartAttestation> = {}
): StartAttestation => ({
  attestationId: 'start-001',
  recognitionId: recognition.recognitionId,
  acceptanceId: acceptance.acceptanceId,
  employerDid: recognition.employerDid,
  practitionerDid: recognition.practitionerDid,
  roleId: recognition.roleId,
  actualStartDate: '2024-02-05T00:00:00Z',
  attestedAt: '2024-02-05T01:00:00Z',
  proof: createProof(recognition.employerDid, '2024-02-05T01:00:00Z'),
  hashAnchor: 'hash-start',
  employmentDetails: {
    roleTitle: 'Registered Nurse',
    schedule: 'full-time',
  },
  ...overrides,
});

const createPath = (overrides: {
  recognition?: Partial<RecognitionEvent>;
  acceptance?: Partial<EmployerAcceptance>;
  start?: Partial<StartAttestation>;
} = {}): EmploymentVerificationPath => {
  const recognition = createRecognition(overrides.recognition);
  const acceptance = createAcceptance(recognition, overrides.acceptance);
  const start = createStart(recognition, acceptance, overrides.start);
  return { recognition, acceptance, start };
};

const captureViolation = (action: () => void): CanonicalPathViolation => {
  try {
    action();
  } catch (error) {
    if (error instanceof CanonicalPathViolation) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected CanonicalPathViolation to be thrown');
};

const expectViolation = (
  action: () => void,
  violationType: CanonicalPathViolation['violationType'],
  messageContains?: string
) => {
  const violation = captureViolation(action);
  expect(violation.violationType).toBe(violationType);
  if (messageContains) {
    expect(violation.message).toContain(messageContains);
  }
  return violation;
};

describe('assertRecognitionEventValid', () => {
  it('accepts a valid recognition event', () => {
    const recognition = createRecognition();

    expect(() => assertRecognitionEventValid(recognition)).not.toThrow();
  });

  it('rejects missing employer DID', () => {
    const recognition = createRecognition({ employerDid: '' });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'RecognitionEvent.employerDid'
    );
  });

  it('rejects employer DID with wrong type', () => {
    const recognition = createRecognition({ employerDid: 42 as unknown as string });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'RecognitionEvent.employerDid'
    );
  });

  it('rejects blank practitioner DID', () => {
    const recognition = createRecognition({ practitionerDid: ' ' });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'RecognitionEvent.practitionerDid'
    );
  });

  it('rejects missing recognitionId', () => {
    const recognition = createRecognition({ recognitionId: '' });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'recognitionId'
    );
  });

  it('rejects recognitionId with wrong type', () => {
    const recognition = createRecognition({ recognitionId: 123 as unknown as string });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'recognitionId'
    );
  });

  it('rejects missing roleId', () => {
    const recognition = createRecognition({ roleId: '' });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'roleId'
    );
  });

  it('rejects roleId with wrong type', () => {
    const recognition = createRecognition({ roleId: 456 as unknown as string });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'roleId'
    );
  });

  it('rejects missing proof', () => {
    const recognition = createRecognition({ proof: undefined as unknown as RecognitionEvent['proof'] });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'cryptographic proof'
    );
  });

  it('rejects proof missing type', () => {
    const recognition = createRecognition({
      proof: {
        ...createProof('did:example:employer', '2024-01-01T00:00:00Z'),
        type: '' as unknown as 'Ed25519Signature2020',
      },
    });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'proof missing required fields'
    );
  });

  it('rejects proof missing verificationMethod', () => {
    const recognition = createRecognition({
      proof: {
        ...createProof('did:example:employer', '2024-01-01T00:00:00Z'),
        verificationMethod: '',
      },
    });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'proof missing required fields'
    );
  });

  it('rejects proof missing proofValue', () => {
    const recognition = createRecognition({
      proof: {
        ...createProof('did:example:employer', '2024-01-01T00:00:00Z'),
        proofValue: '',
      },
    });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'proof missing required fields'
    );
  });

  it('rejects unsupported proof type', () => {
    const recognition = createRecognition({
      proof: {
        ...createProof('did:example:employer', '2024-01-01T00:00:00Z'),
        type: 'RsaSignature2020' as RecognitionEvent['proof']['type'],
      },
    });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_PROOF_TYPE',
      'proof type'
    );
  });

  it('rejects proof that does not reference employer DID', () => {
    const recognition = createRecognition({
      proof: createProof('did:example:someone-else', '2024-01-01T00:00:00Z'),
    });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'SELF_REPORTED',
      'verificationMethod'
    );
  });

  it('rejects invalid recognition timestamp format', () => {
    const recognition = createRecognition({ recognizedAt: '2024-01-01' });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'TIMESTAMP_ORDER',
      'recognizedAt'
    );
  });

  it('rejects missing hash anchor', () => {
    const recognition = createRecognition({ hashAnchor: '' });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'hashAnchor'
    );
  });

  it('rejects hash anchor with wrong type', () => {
    const recognition = createRecognition({ hashAnchor: 999 as unknown as string });

    expectViolation(
      () => assertRecognitionEventValid(recognition),
      'INVALID_SIGNATURE',
      'hashAnchor'
    );
  });
});

describe('assertEmployerAcceptanceValid', () => {
  it('accepts a valid acceptance event', () => {
    const { recognition, acceptance } = createPath();

    expect(() => assertEmployerAcceptanceValid(acceptance, recognition)).not.toThrow();
  });

  it('rejects acceptance with missing recognitionId', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, { recognitionId: '' });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'MISSING_REFERENCE',
      'RecognitionEvent.recognitionId'
    );
  });

  it('rejects acceptance without matching recognition', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, { recognitionId: 'rec-missing' });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'MISSING_REFERENCE',
      'RecognitionEvent.recognitionId'
    );
  });

  it('rejects employer DID mismatch', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      employerDid: 'did:example:other-employer',
      employerProof: createProof('did:example:other-employer', '2024-01-02T01:00:00Z'),
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'DID_MISMATCH',
      'EmployerAcceptance.employerDid'
    );
  });

  it('rejects practitioner DID mismatch', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      practitionerDid: 'did:example:other-practitioner',
      practitionerProof: createProof('did:example:other-practitioner', '2024-01-02T00:00:00Z'),
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'DID_MISMATCH',
      'EmployerAcceptance.practitionerDid'
    );
  });

  it('rejects role mismatch', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, { roleId: 'role:other' });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'DID_MISMATCH',
      'EmployerAcceptance.roleId'
    );
  });

  it('rejects missing practitioner proof', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      practitionerProof: undefined as unknown as EmployerAcceptance['practitionerProof'],
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'INVALID_SIGNATURE',
      'practitionerProof'
    );
  });

  it('rejects practitioner proof that does not reference practitioner DID', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      practitionerProof: createProof('did:example:someone-else', '2024-01-02T00:00:00Z'),
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'INVALID_SIGNATURE',
      'practitionerProof'
    );
  });

  it('rejects missing employer countersignature', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      employerProof: undefined as unknown as EmployerAcceptance['employerProof'],
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'INVALID_SIGNATURE',
      'employerProof'
    );
  });

  it('rejects employer proof that does not reference employer DID', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      employerProof: createProof('did:example:someone-else', '2024-01-02T01:00:00Z'),
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'MISSING_COUNTERSIGNATURE',
      'employerProof'
    );
  });

  it('rejects acceptedAt before recognition', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      acceptedAt: '2023-12-31T00:00:00Z',
      countersignedAt: '2023-12-31T01:00:00Z',
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'TIMESTAMP_ORDER',
      'acceptedAt'
    );
  });

  it('rejects countersignedAt before acceptedAt', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      countersignedAt: '2024-01-01T23:00:00Z',
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'TIMESTAMP_ORDER',
      'countersignedAt'
    );
  });

  it('rejects acceptedAt with invalid timestamp type', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      acceptedAt: 12345 as unknown as string,
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'TIMESTAMP_ORDER',
      'acceptedAt'
    );
  });

  it('rejects acceptedAt with invalid timestamp format', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, { acceptedAt: '2024-01-02' });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'TIMESTAMP_ORDER',
      'acceptedAt'
    );
  });

  it('rejects missing countersignedAt', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, {
      countersignedAt: undefined as unknown as string,
    });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'TIMESTAMP_ORDER',
      'countersignedAt'
    );
  });

  it('rejects missing hash anchor', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, { hashAnchor: '' });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'INVALID_SIGNATURE',
      'hashAnchor'
    );
  });

  it('rejects hash anchor with wrong type', () => {
    const { recognition } = createPath();
    const acceptance = createAcceptance(recognition, { hashAnchor: 123 as unknown as string });

    expectViolation(
      () => assertEmployerAcceptanceValid(acceptance, recognition),
      'INVALID_SIGNATURE',
      'hashAnchor'
    );
  });
});

describe('assertStartAttestationValid', () => {
  it('accepts a valid start attestation', () => {
    const { recognition, acceptance, start } = createPath();

    expect(() => assertStartAttestationValid(start, recognition, acceptance)).not.toThrow();
  });

  it('rejects start with missing recognitionId', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { recognitionId: '' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'MISSING_REFERENCE',
      'RecognitionEvent.recognitionId'
    );
  });

  it('rejects start without matching recognition', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { recognitionId: 'rec-missing' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'MISSING_REFERENCE',
      'RecognitionEvent.recognitionId'
    );
  });

  it('rejects start without matching acceptance', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { acceptanceId: 'acc-missing' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'MISSING_REFERENCE',
      'EmployerAcceptance.acceptanceId'
    );
  });

  it('rejects start with missing acceptanceId', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { acceptanceId: '' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'MISSING_REFERENCE',
      'EmployerAcceptance.acceptanceId'
    );
  });

  it('rejects employer DID mismatch', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, {
      employerDid: 'did:example:other-employer',
      proof: createProof('did:example:other-employer', '2024-02-05T01:00:00Z'),
    });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'DID_MISMATCH',
      'StartAttestation.employerDid'
    );
  });

  it('rejects practitioner DID mismatch', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, {
      practitionerDid: 'did:example:other-practitioner',
    });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'DID_MISMATCH',
      'StartAttestation.practitionerDid'
    );
  });

  it('rejects role mismatch', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { roleId: 'role:other' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'DID_MISMATCH',
      'StartAttestation.roleId'
    );
  });

  it('rejects missing start proof', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, {
      proof: undefined as unknown as StartAttestation['proof'],
    });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'INVALID_SIGNATURE',
      'StartAttestation'
    );
  });

  it('rejects proof that does not reference employer DID', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, {
      proof: createProof('did:example:someone-else', '2024-02-05T01:00:00Z'),
    });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'SELF_REPORTED',
      'employerDid'
    );
  });

  it('rejects start date before acceptance', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, {
      actualStartDate: '2024-01-01T00:00:00Z',
    });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'TIMESTAMP_ORDER',
      'actualStartDate'
    );
  });

  it('rejects attestedAt with invalid format', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { attestedAt: '2024-02-05' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'TIMESTAMP_ORDER',
      'attestedAt'
    );
  });

  it('rejects missing hash anchor', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { hashAnchor: '' });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'INVALID_SIGNATURE',
      'hashAnchor'
    );
  });

  it('rejects hash anchor with wrong type', () => {
    const { recognition, acceptance } = createPath();
    const start = createStart(recognition, acceptance, { hashAnchor: 456 as unknown as string });

    expectViolation(
      () => assertStartAttestationValid(start, recognition, acceptance),
      'INVALID_SIGNATURE',
      'hashAnchor'
    );
  });
});

describe('assertCanonicalPathValid', () => {
  it('accepts a full canonical path', () => {
    const path = createPath();

    expect(() => assertCanonicalPathValid(path)).not.toThrow();
  });

  it('rejects missing recognition', () => {
    const { acceptance, start } = createPath();

    expectViolation(
      () => assertCanonicalPathValid({
        recognition: undefined as unknown as RecognitionEvent,
        acceptance,
        start,
      } as EmploymentVerificationPath),
      'MISSING_RECOGNITION',
      'RecognitionEvent'
    );
  });

  it('rejects missing acceptance', () => {
    const { recognition, start } = createPath();

    expectViolation(
      () => assertCanonicalPathValid({
        recognition,
        acceptance: undefined as unknown as EmployerAcceptance,
        start,
      } as EmploymentVerificationPath),
      'MISSING_ACCEPTANCE',
      'EmployerAcceptance'
    );
  });

  it('rejects missing start', () => {
    const { recognition, acceptance } = createPath();

    expectViolation(
      () => assertCanonicalPathValid({
        recognition,
        acceptance,
        start: undefined as unknown as StartAttestation,
      } as EmploymentVerificationPath),
      'MISSING_START',
      'StartAttestation'
    );
  });
});

describe('isCanonicalPathValid', () => {
  it('returns false when events are missing', () => {
    const { recognition } = createPath();

    expect(isCanonicalPathValid({ recognition })).toBe(false);
  });

  it('returns false when acceptance is missing', () => {
    const { recognition, start } = createPath();

    expect(isCanonicalPathValid({ recognition, start })).toBe(false);
  });

  it('returns false when start is missing', () => {
    const { recognition, acceptance } = createPath();

    expect(isCanonicalPathValid({ recognition, acceptance })).toBe(false);
  });

  it('returns false when validation throws', () => {
    const path = createPath({ start: { roleId: 'role:other' } });

    expect(isCanonicalPathValid(path)).toBe(false);
  });

  it('returns true for valid path', () => {
    const path = createPath();

    expect(isCanonicalPathValid(path)).toBe(true);
  });
});

describe('verifyCanonicalPath', () => {
  it('returns the same path instance when valid', () => {
    const path = createPath();

    expect(verifyCanonicalPath(path)).toBe(path);
  });

  it('throws when path is invalid', () => {
    const path = createPath({ acceptance: { recognitionId: 'rec-missing' } });

    expectViolation(() => verifyCanonicalPath(path), 'MISSING_REFERENCE');
  });
});
