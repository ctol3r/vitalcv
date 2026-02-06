/**
 * FROZEN SPEC: Canonical Path Primitives
 *
 * RecognitionEvent → EmployerAcceptance → StartAttestation
 *
 * ONE valid path. No alternatives. No shortcuts. No self-reporting.
 * Fail closed on every violation.
 *
 * FROZEN: Do not modify without architectural review.
 */

import { describe, expect, it } from 'vitest';
import type {
  EmployerAcceptance,
  EmploymentVerificationPath,
  RecognitionEvent,
  StartAttestation,
  VerifiedCanonicalPath,
} from '../employmentContracts';
import {
  assertCanonicalPathValid,
  assertEmployerAcceptanceValid,
  assertRecognitionEventValid,
  assertStartAttestationValid,
  CanonicalPathViolation,
  isCanonicalPathValid,
  verifyCanonicalPath,
} from '../employmentGuards';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPLOYER_DID = 'did:key:employer-frozen-001';
const PRACTITIONER_DID = 'did:key:practitioner-frozen-001';
const ROLE_ID = 'role:registered-nurse';
const FACILITY_ID = 'facility:alpha';

const proof = (did: string, created: string) => ({
  type: 'Ed25519Signature2020' as const,
  created,
  verificationMethod: `${did}#key-1`,
  proofPurpose: 'assertionMethod' as const,
  proofValue: `proof-${did}-${created}`,
});

const baseRecognition = (overrides: Partial<RecognitionEvent> = {}): RecognitionEvent => ({
  recognitionId: 'rec-frozen-001',
  employerDid: EMPLOYER_DID,
  practitionerDid: PRACTITIONER_DID,
  roleId: ROLE_ID,
  recognizedAt: '2025-03-01T10:00:00.000Z',
  verification: {
    verifiedAt: '2025-03-01T09:00:00.000Z',
    verificationRef: 'verification-ref-frozen-001',
  },
  proof: proof(EMPLOYER_DID, '2025-03-01T10:00:00.000Z'),
  hashAnchor: 'sha256:frozen-recognition-anchor',
  ...overrides,
});

const baseAcceptance = (
  rec: RecognitionEvent,
  overrides: Partial<EmployerAcceptance> = {},
): EmployerAcceptance => ({
  acceptanceId: 'acc-frozen-001',
  recognitionId: rec.recognitionId,
  employerDid: rec.employerDid,
  practitionerDid: rec.practitionerDid,
  roleId: rec.roleId,
  facilityId: FACILITY_ID,
  acceptedAt: '2025-03-02T10:00:00.000Z',
  countersignedAt: '2025-03-02T11:00:00.000Z',
  agreedStartDate: '2025-04-01T00:00:00.000Z',
  practitionerProof: proof(rec.practitionerDid, '2025-03-02T10:00:00.000Z'),
  employerProof: proof(rec.employerDid, '2025-03-02T11:00:00.000Z'),
  hashAnchor: 'sha256:frozen-acceptance-anchor',
  validity: {
    validFrom: '2025-03-02T11:00:00.000Z',
    validUntil: '2025-05-01T00:00:00.000Z',
  },
  terms: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
  psvReportId: 'psv-report-frozen-001',
  ...overrides,
});

const baseStart = (
  rec: RecognitionEvent,
  acc: EmployerAcceptance,
  overrides: Partial<StartAttestation> = {},
): StartAttestation => ({
  attestationId: 'start-frozen-001',
  recognitionId: rec.recognitionId,
  acceptanceId: acc.acceptanceId,
  employerDid: rec.employerDid,
  practitionerDid: rec.practitionerDid,
  roleId: rec.roleId,
  facilityId: acc.facilityId,
  actualStartDate: '2025-04-01T08:00:00.000Z',
  attestedAt: '2025-04-01T09:00:00.000Z',
  proof: proof(rec.employerDid, '2025-04-01T09:00:00.000Z'),
  hashAnchor: 'sha256:frozen-start-anchor',
  employmentDetails: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
  ...overrides,
});

const fullPath = (overrides?: {
  recognition?: Partial<RecognitionEvent>;
  acceptance?: Partial<EmployerAcceptance>;
  start?: Partial<StartAttestation>;
}): EmploymentVerificationPath => {
  const rec = baseRecognition(overrides?.recognition);
  const acc = baseAcceptance(rec, overrides?.acceptance);
  const start = baseStart(rec, acc, overrides?.start);
  return { recognition: rec, acceptance: acc, start };
};

const mustViolate = (
  action: () => void,
  type: CanonicalPathViolation['violationType'],
  contains?: string,
) => {
  try {
    action();
    throw new Error(`Expected CanonicalPathViolation[${type}]`);
  } catch (e) {
    expect(e).toBeInstanceOf(CanonicalPathViolation);
    expect((e as CanonicalPathViolation).violationType).toBe(type);
    if (contains) {
      expect((e as CanonicalPathViolation).message).toContain(contains);
    }
  }
};

// ─── 1. RecognitionEvent ─────────────────────────────────────────────────────

describe('FROZEN: RecognitionEvent', () => {
  describe('Required fields', () => {
    it('recognitionId: non-empty string', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ recognitionId: '' })),
        'INVALID_SIGNATURE',
      );
    });

    it('employerDid: non-empty string', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ employerDid: '' })),
        'INVALID_SIGNATURE',
      );
    });

    it('practitionerDid: non-empty string', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ practitionerDid: '' })),
        'INVALID_SIGNATURE',
      );
    });

    it('roleId: non-empty string', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ roleId: '' })),
        'INVALID_SIGNATURE',
      );
    });

    it('recognizedAt: ISO 8601 full timestamp', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ recognizedAt: '2025-03-01' })),
        'TIMESTAMP_ORDER',
      );
    });

    it('verification: must exist with verifiedAt and verificationRef', () => {
      mustViolate(
        () =>
          assertRecognitionEventValid(
            baseRecognition({ verification: undefined as unknown as RecognitionEvent['verification'] }),
          ),
        'INVALID_SIGNATURE',
      );
    });

    it('proof: must exist with all required fields', () => {
      mustViolate(
        () =>
          assertRecognitionEventValid(
            baseRecognition({ proof: undefined as unknown as RecognitionEvent['proof'] }),
          ),
        'INVALID_SIGNATURE',
      );
    });

    it('hashAnchor: non-empty string', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ hashAnchor: '' })),
        'INVALID_SIGNATURE',
      );
    });
  });

  describe('Invariants', () => {
    it('EMPLOYER-SIGNED ONLY: proof.verificationMethod must reference employerDid', () => {
      mustViolate(
        () =>
          assertRecognitionEventValid(
            baseRecognition({ proof: proof(PRACTITIONER_DID, '2025-03-01T10:00:00.000Z') }),
          ),
        'SELF_REPORTED',
      );
    });

    it('VERIFICATION BEFORE RECOGNITION: verifiedAt <= recognizedAt', () => {
      mustViolate(
        () =>
          assertRecognitionEventValid(
            baseRecognition({
              verification: {
                verifiedAt: '2025-03-02T00:00:00.000Z',
                verificationRef: 'ref',
              },
            }),
          ),
        'TIMESTAMP_ORDER',
      );
    });

    it('PROOF TYPE RESTRICTED: only Ed25519Signature2020 or JcsEd25519Signature2020', () => {
      mustViolate(
        () =>
          assertRecognitionEventValid(
            baseRecognition({
              proof: {
                ...proof(EMPLOYER_DID, '2025-03-01T10:00:00.000Z'),
                type: 'RsaSignature2020' as RecognitionEvent['proof']['type'],
              },
            }),
          ),
        'INVALID_PROOF_TYPE',
      );
    });

    it('VALID RECOGNITION: all fields present and correct passes', () => {
      expect(() => assertRecognitionEventValid(baseRecognition())).not.toThrow();
    });
  });

  describe('Must-fail: type coercion attacks', () => {
    it('rejects numeric employerDid', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ employerDid: 42 as unknown as string })),
        'INVALID_SIGNATURE',
      );
    });

    it('rejects numeric recognitionId', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ recognitionId: 123 as unknown as string })),
        'INVALID_SIGNATURE',
      );
    });

    it('rejects numeric hashAnchor', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ hashAnchor: 999 as unknown as string })),
        'INVALID_SIGNATURE',
      );
    });

    it('rejects whitespace-only practitionerDid', () => {
      mustViolate(
        () => assertRecognitionEventValid(baseRecognition({ practitionerDid: '   ' })),
        'INVALID_SIGNATURE',
      );
    });
  });
});

// ─── 2. EmployerAcceptance ───────────────────────────────────────────────────

describe('FROZEN: EmployerAcceptance', () => {
  describe('Required fields', () => {
    const rec = baseRecognition();

    it('recognitionId: must reference existing RecognitionEvent', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(baseAcceptance(rec, { recognitionId: 'rec-nonexistent' }), rec),
        'MISSING_REFERENCE',
      );
    });

    it('facilityId: non-empty string', () => {
      mustViolate(
        () => assertEmployerAcceptanceValid(baseAcceptance(rec, { facilityId: '' }), rec),
        'INVALID_SIGNATURE',
      );
    });

    it('psvReportId: required (NCQA CR1 + CMS CoP)', () => {
      mustViolate(
        () => assertEmployerAcceptanceValid(baseAcceptance(rec, { psvReportId: '' }), rec),
        'MISSING_REFERENCE',
      );
    });

    it('hashAnchor: non-empty string', () => {
      mustViolate(
        () => assertEmployerAcceptanceValid(baseAcceptance(rec, { hashAnchor: '' }), rec),
        'INVALID_SIGNATURE',
      );
    });
  });

  describe('Invariants', () => {
    const rec = baseRecognition();

    it('DUAL SIGNATURE: practitionerProof required', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              practitionerProof: undefined as unknown as EmployerAcceptance['practitionerProof'],
            }),
            rec,
          ),
        'INVALID_SIGNATURE',
      );
    });

    it('DUAL SIGNATURE: employerProof (countersignature) required', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              employerProof: undefined as unknown as EmployerAcceptance['employerProof'],
            }),
            rec,
          ),
        'INVALID_SIGNATURE',
      );
    });

    it('PRACTITIONER PROOF must reference practitionerDid', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              practitionerProof: proof('did:key:impostor', '2025-03-02T10:00:00.000Z'),
            }),
            rec,
          ),
        'INVALID_SIGNATURE',
      );
    });

    it('EMPLOYER COUNTERSIGNATURE must reference employerDid', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              employerProof: proof('did:key:impostor', '2025-03-02T11:00:00.000Z'),
            }),
            rec,
          ),
        'MISSING_COUNTERSIGNATURE',
      );
    });

    it('DID MATCH: employerDid must match Recognition.employerDid', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              employerDid: 'did:key:other-employer',
              employerProof: proof('did:key:other-employer', '2025-03-02T11:00:00.000Z'),
            }),
            rec,
          ),
        'DID_MISMATCH',
      );
    });

    it('DID MATCH: practitionerDid must match Recognition.practitionerDid', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              practitionerDid: 'did:key:other-practitioner',
              practitionerProof: proof('did:key:other-practitioner', '2025-03-02T10:00:00.000Z'),
            }),
            rec,
          ),
        'DID_MISMATCH',
      );
    });

    it('DID MATCH: roleId must match Recognition.roleId', () => {
      mustViolate(
        () => assertEmployerAcceptanceValid(baseAcceptance(rec, { roleId: 'role:other' }), rec),
        'DID_MISMATCH',
      );
    });

    it('TIMESTAMP ORDER: acceptedAt must be after recognizedAt', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, {
              acceptedAt: '2025-02-01T00:00:00.000Z',
              countersignedAt: '2025-02-01T01:00:00.000Z',
            }),
            rec,
          ),
        'TIMESTAMP_ORDER',
      );
    });

    it('TIMESTAMP ORDER: countersignedAt must be after acceptedAt', () => {
      mustViolate(
        () =>
          assertEmployerAcceptanceValid(
            baseAcceptance(rec, { countersignedAt: '2025-03-02T09:00:00.000Z' }),
            rec,
          ),
        'TIMESTAMP_ORDER',
      );
    });

    it('EXPIRATION: acceptance after Recognition.terms.expiresAt is rejected', () => {
      const expRec = baseRecognition({ terms: { expiresAt: '2025-03-01T12:00:00.000Z' } });
      mustViolate(
        () => assertEmployerAcceptanceValid(baseAcceptance(expRec), expRec),
        'EXPIRED',
      );
    });

    it('VALID ACCEPTANCE: all fields present and correct passes', () => {
      expect(() => assertEmployerAcceptanceValid(baseAcceptance(rec), rec)).not.toThrow();
    });
  });
});

// ─── 3. StartAttestation ─────────────────────────────────────────────────────

describe('FROZEN: StartAttestation', () => {
  describe('Required fields', () => {
    const rec = baseRecognition();
    const acc = baseAcceptance(rec);

    it('recognitionId: must match RecognitionEvent', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(baseStart(rec, acc, { recognitionId: 'rec-wrong' }), rec, acc),
        'MISSING_REFERENCE',
      );
    });

    it('acceptanceId: must match EmployerAcceptance', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(baseStart(rec, acc, { acceptanceId: 'acc-wrong' }), rec, acc),
        'MISSING_REFERENCE',
      );
    });

    it('facilityId: non-empty string', () => {
      mustViolate(
        () => assertStartAttestationValid(baseStart(rec, acc, { facilityId: '' }), rec, acc),
        'INVALID_SIGNATURE',
      );
    });

    it('hashAnchor: non-empty string', () => {
      mustViolate(
        () => assertStartAttestationValid(baseStart(rec, acc, { hashAnchor: '' }), rec, acc),
        'INVALID_SIGNATURE',
      );
    });
  });

  describe('Invariants', () => {
    const rec = baseRecognition();
    const acc = baseAcceptance(rec);

    it('EMPLOYER-SIGNED ONLY: proof must reference employerDid', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, {
              proof: proof(PRACTITIONER_DID, '2025-04-01T09:00:00.000Z'),
            }),
            rec,
            acc,
          ),
        'SELF_REPORTED',
      );
    });

    it('NO SELF-REPORTING: practitioner-signed proof is rejected', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, {
              proof: proof(PRACTITIONER_DID, '2025-04-01T09:00:00.000Z'),
            }),
            rec,
            acc,
          ),
        'SELF_REPORTED',
      );
    });

    it('DID MATCH: employerDid must match across all three events', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, {
              employerDid: 'did:key:wrong-employer',
              proof: proof('did:key:wrong-employer', '2025-04-01T09:00:00.000Z'),
            }),
            rec,
            acc,
          ),
        'DID_MISMATCH',
      );
    });

    it('DID MATCH: practitionerDid must match across all three events', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, { practitionerDid: 'did:key:wrong-practitioner' }),
            rec,
            acc,
          ),
        'DID_MISMATCH',
      );
    });

    it('DID MATCH: roleId must match across all three events', () => {
      mustViolate(
        () => assertStartAttestationValid(baseStart(rec, acc, { roleId: 'role:other' }), rec, acc),
        'DID_MISMATCH',
      );
    });

    it('SCOPE MATCH: facilityId must match Acceptance.facilityId', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, { facilityId: 'facility:beta' }),
            rec,
            acc,
          ),
        'SCOPE_MISMATCH',
      );
    });

    it('TIMESTAMP ORDER: actualStartDate must be >= acceptedAt', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, { actualStartDate: '2025-02-01T00:00:00.000Z' }),
            rec,
            acc,
          ),
        'TIMESTAMP_ORDER',
      );
    });

    it('TIMESTAMP FORMAT: attestedAt must be full ISO 8601', () => {
      mustViolate(
        () =>
          assertStartAttestationValid(
            baseStart(rec, acc, { attestedAt: '2025-04-01' }),
            rec,
            acc,
          ),
        'TIMESTAMP_ORDER',
      );
    });

    it('VALID START: all fields present and correct passes', () => {
      expect(() => assertStartAttestationValid(baseStart(rec, acc), rec, acc)).not.toThrow();
    });
  });
});

// ─── 4. Illegal Transitions ─────────────────────────────────────────────────

describe('FROZEN: Illegal Transitions', () => {
  it('Start without Recognition → MUST FAIL', () => {
    const path = fullPath();
    mustViolate(
      () =>
        assertCanonicalPathValid({
          recognition: undefined as unknown as RecognitionEvent,
          acceptance: path.acceptance,
          start: path.start,
        }),
      'MISSING_RECOGNITION',
    );
  });

  it('Start without Acceptance → MUST FAIL', () => {
    const path = fullPath();
    mustViolate(
      () =>
        assertCanonicalPathValid({
          recognition: path.recognition,
          acceptance: undefined as unknown as EmployerAcceptance,
          start: path.start,
        }),
      'MISSING_ACCEPTANCE',
    );
  });

  it('Acceptance without Recognition → MUST FAIL', () => {
    const path = fullPath();
    mustViolate(
      () =>
        assertCanonicalPathValid({
          recognition: undefined as unknown as RecognitionEvent,
          acceptance: path.acceptance,
          start: path.start,
        }),
      'MISSING_RECOGNITION',
    );
  });

  it('Recognition → Start (skip Acceptance) → MUST FAIL', () => {
    const path = fullPath();
    mustViolate(
      () =>
        assertCanonicalPathValid({
          recognition: path.recognition,
          acceptance: undefined as unknown as EmployerAcceptance,
          start: path.start,
        }),
      'MISSING_ACCEPTANCE',
    );
  });

  it('Start alone → MUST FAIL', () => {
    const path = fullPath();
    mustViolate(
      () =>
        assertCanonicalPathValid({
          recognition: undefined as unknown as RecognitionEvent,
          acceptance: undefined as unknown as EmployerAcceptance,
          start: path.start,
        }),
      'MISSING_RECOGNITION',
    );
  });

  it('Cross-employer events → MUST FAIL', () => {
    const path = fullPath({
      acceptance: {
        employerDid: 'did:key:employer-B',
        employerProof: proof('did:key:employer-B', '2025-03-02T11:00:00.000Z'),
      },
    });
    expect(isCanonicalPathValid(path)).toBe(false);
  });

  it('Cross-practitioner events → MUST FAIL', () => {
    const path = fullPath({
      start: { practitionerDid: 'did:key:practitioner-B' },
    });
    expect(isCanonicalPathValid(path)).toBe(false);
  });

  it('Cross-facility Start → MUST FAIL', () => {
    const path = fullPath({
      start: { facilityId: 'facility:gamma' },
    });
    expect(isCanonicalPathValid(path)).toBe(false);
  });

  it('Backward timestamps → MUST FAIL', () => {
    const path = fullPath({
      start: { actualStartDate: '2025-01-01T00:00:00.000Z' },
    });
    expect(isCanonicalPathValid(path)).toBe(false);
  });
});

// ─── 5. VerifiedCanonicalPath ────────────────────────────────────────────────

describe('FROZEN: VerifiedCanonicalPath branded type', () => {
  it('verifyCanonicalPath() returns branded path for valid input', () => {
    const path = fullPath();
    const verified = verifyCanonicalPath(path);

    expect(verified).toBe(path);
    expect(verified.recognition).toBe(path.recognition);
    expect(verified.acceptance).toBe(path.acceptance);
    expect(verified.start).toBe(path.start);
  });

  it('verifyCanonicalPath() throws for any invalid path', () => {
    const path = fullPath({ acceptance: { recognitionId: 'rec-tampered' } });
    expect(() => verifyCanonicalPath(path)).toThrow(CanonicalPathViolation);
  });

  it('isCanonicalPathValid() returns true only for complete valid path', () => {
    expect(isCanonicalPathValid(fullPath())).toBe(true);
  });

  it('isCanonicalPathValid() returns false for partial path', () => {
    const { recognition } = fullPath();
    expect(isCanonicalPathValid({ recognition })).toBe(false);
  });

  it('isCanonicalPathValid() returns false for tampered path', () => {
    const path = fullPath({ start: { roleId: 'role:tampered' } });
    expect(isCanonicalPathValid(path)).toBe(false);
  });
});

// ─── 6. Determinism ──────────────────────────────────────────────────────────

describe('FROZEN: Determinism', () => {
  it('same inputs produce identical validation results', () => {
    const path1 = fullPath();
    const path2 = fullPath();

    expect(isCanonicalPathValid(path1)).toBe(isCanonicalPathValid(path2));
    expect(() => assertCanonicalPathValid(path1)).not.toThrow();
    expect(() => assertCanonicalPathValid(path2)).not.toThrow();
  });

  it('verifyCanonicalPath returns same reference each call', () => {
    const path = fullPath();
    const v1 = verifyCanonicalPath(path);
    const v2 = verifyCanonicalPath(path);
    expect(v1).toBe(v2);
  });
});
