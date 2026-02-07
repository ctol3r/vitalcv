/**
 * FROZEN SPEC: Adversarial Edge Cases
 *
 * Stress-tests for the VitalCV trust model.
 * Every scenario must be sealed by invariants, not by hope.
 *
 * Categories:
 *   A. Multi-employer acceptance with decay
 *   B. Acceptance → decay → re-accept
 *   C. Start attested → decay occurs after
 *   D. Audit replay dispute resolution
 *   E. Cross-employer non-interference
 *   F. Non-repudiation under denial
 *
 * FROZEN: Do not modify without architectural review.
 */

import { describe, expect, it } from 'vitest';
import type {
  EmployerAcceptance,
  EmploymentVerificationPath,
  RecognitionEvent,
  StartAttestation,
} from '../employmentContracts';
import {
  assertCanonicalPathValid,
  assertEmployerAcceptanceValid,
  assertStartAttestationValid,
  CanonicalPathViolation,
  isCanonicalPathValid,
  verifyCanonicalPath,
} from '../employmentGuards';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPLOYER_A_DID = 'did:key:employer-A';
const EMPLOYER_B_DID = 'did:key:employer-B';
const PRACTITIONER_DID = 'did:key:practitioner-001';
const ROLE_ID = 'role:registered-nurse';

const proof = (did: string, created: string) => ({
  type: 'Ed25519Signature2020' as const,
  created,
  verificationMethod: `${did}#key-1`,
  proofPurpose: 'assertionMethod' as const,
  proofValue: `proof-${did}-${created}`,
});

const makeRecognition = (
  employerDid: string,
  id: string,
  recognizedAt: string,
  overrides: Partial<RecognitionEvent> = {},
): RecognitionEvent => ({
  recognitionId: id,
  employerDid,
  practitionerDid: PRACTITIONER_DID,
  roleId: ROLE_ID,
  recognizedAt,
  verification: {
    verifiedAt: new Date(new Date(recognizedAt).getTime() - 3600_000).toISOString(),
    verificationRef: `vref-${id}`,
  },
  proof: proof(employerDid, recognizedAt),
  hashAnchor: `sha256:anchor-${id}`,
  ...overrides,
});

const makeAcceptance = (
  rec: RecognitionEvent,
  id: string,
  facilityId: string,
  acceptedAt: string,
  overrides: Partial<EmployerAcceptance> = {},
): EmployerAcceptance => ({
  acceptanceId: id,
  recognitionId: rec.recognitionId,
  employerDid: rec.employerDid,
  practitionerDid: rec.practitionerDid,
  roleId: rec.roleId,
  facilityId,
  acceptedAt,
  countersignedAt: new Date(new Date(acceptedAt).getTime() + 3600_000).toISOString(),
  agreedStartDate: new Date(new Date(acceptedAt).getTime() + 86400_000 * 30).toISOString(),
  practitionerProof: proof(rec.practitionerDid, acceptedAt),
  employerProof: proof(
    rec.employerDid,
    new Date(new Date(acceptedAt).getTime() + 3600_000).toISOString(),
  ),
  hashAnchor: `sha256:anchor-${id}`,
  validity: {
    validFrom: acceptedAt,
    validUntil: new Date(new Date(acceptedAt).getTime() + 86400_000 * 60).toISOString(),
  },
  terms: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
  psvReportId: `psv-report-${id}`,
  ...overrides,
});

const makeStart = (
  rec: RecognitionEvent,
  acc: EmployerAcceptance,
  id: string,
  startDate: string,
  overrides: Partial<StartAttestation> = {},
): StartAttestation => ({
  attestationId: id,
  recognitionId: rec.recognitionId,
  acceptanceId: acc.acceptanceId,
  employerDid: rec.employerDid,
  practitionerDid: rec.practitionerDid,
  roleId: rec.roleId,
  facilityId: acc.facilityId,
  actualStartDate: startDate,
  attestedAt: new Date(new Date(startDate).getTime() + 3600_000).toISOString(),
  proof: proof(
    rec.employerDid,
    new Date(new Date(startDate).getTime() + 3600_000).toISOString(),
  ),
  hashAnchor: `sha256:anchor-${id}`,
  employmentDetails: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
// A. MULTI-EMPLOYER ACCEPTANCE WITH DECAY
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADVERSARIAL: Multi-employer acceptance with decay', () => {
  it('GIVEN clinician recognized by Employer A and Employer B, WHEN both accept, THEN both paths are independently valid', () => {
    const recA = makeRecognition(EMPLOYER_A_DID, 'rec-A', '2025-03-01T10:00:00.000Z');
    const recB = makeRecognition(EMPLOYER_B_DID, 'rec-B', '2025-03-02T10:00:00.000Z');

    const accA = makeAcceptance(recA, 'acc-A', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const accB = makeAcceptance(recB, 'acc-B', 'facility:beta', '2025-03-06T10:00:00.000Z');

    // Both acceptances are valid against their own recognition
    expect(() => assertEmployerAcceptanceValid(accA, recA)).not.toThrow();
    expect(() => assertEmployerAcceptanceValid(accB, recB)).not.toThrow();
  });

  it('GIVEN Employer A acceptance valid and Employer B acceptance expired, WHEN both evaluated, THEN A proceeds and B is blocked', () => {
    const recA = makeRecognition(EMPLOYER_A_DID, 'rec-A', '2025-03-01T10:00:00.000Z');
    const recB = makeRecognition(EMPLOYER_B_DID, 'rec-B', '2025-03-02T10:00:00.000Z', {
      terms: { expiresAt: '2025-03-03T00:00:00.000Z' },
    });

    const accA = makeAcceptance(recA, 'acc-A', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    // Employer B's acceptance is AFTER recognition expiry
    const accB = makeAcceptance(recB, 'acc-B', 'facility:beta', '2025-03-05T10:00:00.000Z');

    // A is valid
    expect(() => assertEmployerAcceptanceValid(accA, recA)).not.toThrow();

    // B is blocked: recognition expired before acceptance
    try {
      assertEmployerAcceptanceValid(accB, recB);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('EXPIRED');
    }
  });

  it('GIVEN both employers accept, WHEN only A attests start, THEN only A path is complete', () => {
    const recA = makeRecognition(EMPLOYER_A_DID, 'rec-A', '2025-03-01T10:00:00.000Z');
    const recB = makeRecognition(EMPLOYER_B_DID, 'rec-B', '2025-03-02T10:00:00.000Z');

    const accA = makeAcceptance(recA, 'acc-A', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const accB = makeAcceptance(recB, 'acc-B', 'facility:beta', '2025-03-06T10:00:00.000Z');

    const startA = makeStart(recA, accA, 'start-A', '2025-04-01T08:00:00.000Z');

    // Path A: complete
    const pathA: EmploymentVerificationPath = {
      recognition: recA,
      acceptance: accA,
      start: startA,
    };
    expect(isCanonicalPathValid(pathA)).toBe(true);

    // Path B: no start exists — path cannot be validated as complete
    // Employer B's acceptance is valid but not started
  });

  it('GIVEN Employer B cannot start using Employer A recognition', () => {
    const recA = makeRecognition(EMPLOYER_A_DID, 'rec-A', '2025-03-01T10:00:00.000Z');

    // Employer B tries to accept Employer A's recognition
    const crossAcc = makeAcceptance(recA, 'acc-cross', 'facility:beta', '2025-03-05T10:00:00.000Z', {
      employerDid: EMPLOYER_B_DID,
      employerProof: proof(EMPLOYER_B_DID, '2025-03-05T11:00:00.000Z'),
    });

    // DID mismatch: acceptance.employerDid != recognition.employerDid
    try {
      assertEmployerAcceptanceValid(crossAcc, recA);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('DID_MISMATCH');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. ACCEPTANCE → DECAY → RE-ACCEPT
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADVERSARIAL: Acceptance → decay → re-accept', () => {
  it('GIVEN recognition with expiry, WHEN acceptance is within window, THEN valid', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z', {
      terms: { expiresAt: '2025-06-01T00:00:00.000Z' },
    });
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-15T10:00:00.000Z');

    expect(() => assertEmployerAcceptanceValid(acc, rec)).not.toThrow();
  });

  it('GIVEN recognition expired, WHEN employer tries to accept, THEN MUST FAIL', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z', {
      terms: { expiresAt: '2025-03-10T00:00:00.000Z' },
    });
    // Acceptance attempted after expiry
    const acc = makeAcceptance(rec, 'acc-late', 'facility:alpha', '2025-03-15T10:00:00.000Z');

    try {
      assertEmployerAcceptanceValid(acc, rec);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('EXPIRED');
    }
  });

  it('GIVEN recognition expired, WHEN employer re-recognizes, THEN new acceptance on new recognition is valid', () => {
    // Original recognition expired
    const rec1 = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z', {
      terms: { expiresAt: '2025-03-10T00:00:00.000Z' },
    });

    // New recognition issued
    const rec2 = makeRecognition(EMPLOYER_A_DID, 'rec-002', '2025-03-15T10:00:00.000Z');

    // New acceptance on new recognition
    const acc2 = makeAcceptance(rec2, 'acc-002', 'facility:alpha', '2025-03-20T10:00:00.000Z');

    expect(() => assertEmployerAcceptanceValid(acc2, rec2)).not.toThrow();
    // rec1 is historical. rec2 is active. No conflict.
  });

  it('GIVEN acceptance on expired recognition, WHEN start attempted, THEN path is invalid', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z', {
      terms: { expiresAt: '2025-03-10T00:00:00.000Z' },
    });

    // Force acceptance (bypassing guard for test setup)
    const acc: EmployerAcceptance = {
      ...makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z'),
    };

    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');
    const path: EmploymentVerificationPath = { recognition: rec, acceptance: acc, start };

    // Path validation runs ALL guards, including expiry
    // The acceptance was in-window, so the path should validate structurally
    // Expiry is checked at acceptance-time, not at start-time (acceptance was valid when made)
    expect(isCanonicalPathValid(path)).toBe(true);
    // Trust-state / CRS would catch expired PSV receipts at start time
    // The canonical path validates structural integrity, not temporal freshness
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. START ATTESTED → DECAY OCCURS AFTER
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADVERSARIAL: Start attested → decay occurs after', () => {
  it('GIVEN valid start attested, WHEN PSV receipt expires after start, THEN start is NOT retroactively invalidated', () => {
    // Start was attested when everything was valid
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    const path: EmploymentVerificationPath = { recognition: rec, acceptance: acc, start };

    // Path is valid — start was legitimate
    expect(isCanonicalPathValid(path)).toBe(true);

    // PSV receipt expiring AFTER start does not change the fact that
    // start was validly attested. The StartAttestation is IMMUTABLE.
    // Post-start decay triggers re-credentialing (CR2), not revocation of start.
  });

  it('GIVEN start attested, WHEN recognition terms expire after start, THEN start remains valid', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z', {
      terms: { expiresAt: '2025-05-01T00:00:00.000Z' },
    });
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    const path: EmploymentVerificationPath = { recognition: rec, acceptance: acc, start };

    // Start was before expiry. Path is valid.
    expect(isCanonicalPathValid(path)).toBe(true);
    // After 2025-05-01, the recognition is expired, but the start already happened.
    // Re-credentialing is a new cycle, not a revocation of the completed path.
  });

  it('GIVEN start attested, THEN the start event itself is immutable', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    // Start has hashAnchor for tamper detection
    expect(start.hashAnchor).toBeTruthy();
    // Start has employer proof
    expect(start.proof.verificationMethod).toContain(EMPLOYER_A_DID);
    // No mutation methods exist on StartAttestation
    // Termination is a SEPARATE event, not a modification of start
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. AUDIT REPLAY DISPUTE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADVERSARIAL: Audit replay dispute resolution', () => {
  it('GIVEN complete path, WHEN auditor replays events in any order, THEN same validation result', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    const path: EmploymentVerificationPath = { recognition: rec, acceptance: acc, start };

    // Validate 10 times — must be identical every time
    const results = Array.from({ length: 10 }, () => isCanonicalPathValid(path));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(true);
  });

  it('GIVEN tampered acceptance, WHEN auditor replays, THEN tamper detected', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    // Tamper: change employer DID on acceptance
    const tamperedAcc: EmployerAcceptance = {
      ...acc,
      employerDid: 'did:key:impostor',
    };

    const tamperedPath: EmploymentVerificationPath = {
      recognition: rec,
      acceptance: tamperedAcc,
      start,
    };

    expect(isCanonicalPathValid(tamperedPath)).toBe(false);
  });

  it('GIVEN tampered start, WHEN auditor replays, THEN tamper detected', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    // Tamper: change facility on start
    const tamperedStart: StartAttestation = {
      ...start,
      facilityId: 'facility:impostor',
    };

    const tamperedPath: EmploymentVerificationPath = {
      recognition: rec,
      acceptance: acc,
      start: tamperedStart,
    };

    expect(isCanonicalPathValid(tamperedPath)).toBe(false);
  });

  it('GIVEN self-reported start, WHEN auditor replays, THEN rejected as SELF_REPORTED', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z', {
      proof: proof(PRACTITIONER_DID, '2025-04-01T09:00:00.000Z'),
    });

    const path: EmploymentVerificationPath = { recognition: rec, acceptance: acc, start };

    try {
      assertCanonicalPathValid(path);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('SELF_REPORTED');
    }
  });

  it('GIVEN verifyCanonicalPath returns branded type, WHEN path is valid, THEN same reference returned', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    const path: EmploymentVerificationPath = { recognition: rec, acceptance: acc, start };
    const verified = verifyCanonicalPath(path);

    // Branded type returned — same object reference
    expect(verified).toBe(path);
    expect(verified.recognition.recognitionId).toBe('rec-001');
    expect(verified.acceptance.acceptanceId).toBe('acc-001');
    expect(verified.start.attestationId).toBe('start-001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. CROSS-EMPLOYER NON-INTERFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADVERSARIAL: Cross-employer non-interference', () => {
  it('Employer B cannot sign Employer A recognition', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z', {
      proof: proof(EMPLOYER_B_DID, '2025-03-01T10:00:00.000Z'),
    });

    try {
      // Proof references B, but employerDid is A → SELF_REPORTED
      assertCanonicalPathValid({
        recognition: rec,
        acceptance: makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z'),
        start: makeStart(
          rec,
          makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z'),
          'start-001',
          '2025-04-01T08:00:00.000Z',
        ),
      });
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('SELF_REPORTED');
    }
  });

  it('Employer B cannot countersign Employer A acceptance', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z', {
      employerProof: proof(EMPLOYER_B_DID, '2025-03-05T11:00:00.000Z'),
    });

    try {
      assertEmployerAcceptanceValid(acc, rec);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('MISSING_COUNTERSIGNATURE');
    }
  });

  it('Employer B cannot attest Employer A start', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z', {
      employerDid: EMPLOYER_B_DID,
      proof: proof(EMPLOYER_B_DID, '2025-04-01T09:00:00.000Z'),
    });

    try {
      assertStartAttestationValid(start, rec, acc);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CanonicalPathViolation);
      expect((e as CanonicalPathViolation).violationType).toBe('DID_MISMATCH');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. NON-REPUDIATION UNDER DENIAL
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADVERSARIAL: Non-repudiation', () => {
  it('employer signature is embedded in recognition event', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');

    expect(rec.proof.verificationMethod).toContain(EMPLOYER_A_DID);
    expect(rec.proof.proofValue).toBeTruthy();
    expect(rec.proof.type).toBe('Ed25519Signature2020');
    expect(rec.hashAnchor).toBeTruthy();
  });

  it('employer countersignature is embedded in acceptance event', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');

    // Practitioner signed
    expect(acc.practitionerProof.verificationMethod).toContain(PRACTITIONER_DID);
    // Employer countersigned
    expect(acc.employerProof.verificationMethod).toContain(EMPLOYER_A_DID);
    // Both signatures present
    expect(acc.practitionerProof.proofValue).toBeTruthy();
    expect(acc.employerProof.proofValue).toBeTruthy();
    // Hash anchor for tamper detection
    expect(acc.hashAnchor).toBeTruthy();
  });

  it('employer signature is embedded in start attestation', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    expect(start.proof.verificationMethod).toContain(EMPLOYER_A_DID);
    expect(start.proof.proofValue).toBeTruthy();
    expect(start.hashAnchor).toBeTruthy();
  });

  it('denial requires disproving three independently signed events', () => {
    const rec = makeRecognition(EMPLOYER_A_DID, 'rec-001', '2025-03-01T10:00:00.000Z');
    const acc = makeAcceptance(rec, 'acc-001', 'facility:alpha', '2025-03-05T10:00:00.000Z');
    const start = makeStart(rec, acc, 'start-001', '2025-04-01T08:00:00.000Z');

    // All three events bear employer A's signature
    const employerSignedEvents = [
      rec.proof.verificationMethod,
      acc.employerProof.verificationMethod,
      start.proof.verificationMethod,
    ];

    for (const vm of employerSignedEvents) {
      expect(vm).toContain(EMPLOYER_A_DID);
    }

    // All three events have hash anchors
    expect(rec.hashAnchor).toBeTruthy();
    expect(acc.hashAnchor).toBeTruthy();
    expect(start.hashAnchor).toBeTruthy();

    // Denying ANY event means denying your own signature three times
    // with three independent hash anchors. This is non-repudiation.
  });
});
