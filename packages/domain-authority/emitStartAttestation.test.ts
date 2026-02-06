/**
 * ANTIGRAVITY LIVE PRIMITIVE TESTS
 *
 * These tests PROVE that emitStartAttestation() is the ONLY way to start employment.
 *
 * TESTS MUST PROVE:
 * - No start without acceptance
 * - No acceptance without recognition
 * - No alternate start path exists
 */

import type { EmployerAcceptance, RecognitionEvent } from '@vitalcv/domain-common';
import { CanonicalPathViolation } from '@vitalcv/domain-common';
import { describe, expect, it } from 'vitest';
import { canEmitStartAttestation, emitStartAttestation } from './emitStartAttestation';

// Test fixtures
const EMPLOYER_DID = 'did:key:employer123';
const PRACTITIONER_DID = 'did:key:practitioner456';
const ROLE_ID = 'role-surgeon-001';
const RECOGNITION_ID = 'recognition-001';
const ACCEPTANCE_ID = 'acceptance-001';

const mockSigningKey = {
  verificationMethod: `${EMPLOYER_DID}#key-1`,
  sign: (data: string) => `mock-signature-${data.substring(0, 10)}`,
};

function createValidRecognition(): RecognitionEvent {
  return {
    recognitionId: RECOGNITION_ID,
    employerDid: EMPLOYER_DID,
    practitionerDid: PRACTITIONER_DID,
    roleId: ROLE_ID,
    recognizedAt: '2025-01-01T10:00:00.000Z',
    verification: {
      verifiedAt: '2025-01-01T09:55:00.000Z',
      verificationRef: 'verification-ref-001',
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: '2025-01-01T10:00:00.000Z',
      verificationMethod: `${EMPLOYER_DID}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: 'z3MvGWYcXQ...',
    },
    hashAnchor: 'QmHash123...',
  };
}

function createValidAcceptance(): EmployerAcceptance {
  return {
    acceptanceId: ACCEPTANCE_ID,
    recognitionId: RECOGNITION_ID,
    employerDid: EMPLOYER_DID,
    practitionerDid: PRACTITIONER_DID,
    roleId: ROLE_ID,
    facilityId: 'facility:alpha',
    acceptedAt: '2025-01-02T10:00:00.000Z',
    countersignedAt: '2025-01-02T11:00:00.000Z',
    agreedStartDate: '2025-01-15T00:00:00.000Z',
    practitionerProof: {
      type: 'Ed25519Signature2020',
      created: '2025-01-02T10:00:00.000Z',
      verificationMethod: `${PRACTITIONER_DID}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: 'z4NvHXZdYR...',
    },
    employerProof: {
      type: 'Ed25519Signature2020',
      created: '2025-01-02T11:00:00.000Z',
      verificationMethod: `${EMPLOYER_DID}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: 'z5OwIYAeZS...',
    },
    hashAnchor: 'QmHash456...',
    validity: {
      validFrom: '2025-01-02T11:00:00.000Z',
      validUntil: '2025-02-01T11:00:00.000Z',
    },
    terms: {
      roleTitle: 'General Surgeon',
      department: 'Surgery',
      schedule: 'full-time',
    },
    psvReportId: 'psv-report-001',
  };
}

describe('ANTIGRAVITY PROOF: emitStartAttestation()', () => {
  describe('PROOF: No start without acceptance', () => {
    it('MUST FAIL when acceptance is missing', async () => {
      const recognition = createValidRecognition();
      const acceptance = null as unknown as EmployerAcceptance;

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow();
    });

    it('MUST FAIL when acceptance has wrong recognitionId', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();
      acceptance.recognitionId = 'WRONG_RECOGNITION_ID';

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow(CanonicalPathViolation);
    });

    it('MUST FAIL when acceptance timestamp is after start date', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-01T08:00:00.000Z', // Before acceptance
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow(/Start date.*cannot be before acceptance date/);
    });
  });

  describe('PROOF: No acceptance without recognition', () => {
    it('MUST FAIL when recognition is missing', async () => {
      const recognition = null as unknown as RecognitionEvent;
      const acceptance = createValidAcceptance();

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow();
    });

    it('MUST FAIL when recognition has invalid proof', async () => {
      const recognition = createValidRecognition();
      (recognition.proof as any) = undefined;
      const acceptance = createValidAcceptance();

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow(CanonicalPathViolation);
    });

    it('MUST FAIL when recognition is self-reported (practitioner-signed)', async () => {
      const recognition = createValidRecognition();
      recognition.proof.verificationMethod = `${PRACTITIONER_DID}#key-1`;
      const acceptance = createValidAcceptance();

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow(CanonicalPathViolation);
    });
  });

  describe('PROOF: Employer DID must match across all events', () => {
    it('MUST FAIL when start employerDid differs from recognition', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: 'did:key:different-employer',
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow(/Employer DID mismatch/);
    });

    it('MUST FAIL when acceptance employerDid differs from recognition', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();
      acceptance.employerDid = 'did:key:different-employer';

      await expect(
        emitStartAttestation({
          recognition,
          acceptance,
          actualStartDate: '2025-01-15T08:00:00.000Z',
          employerDid: EMPLOYER_DID,
          signingKey: mockSigningKey,
        }),
      ).rejects.toThrow(CanonicalPathViolation);
    });
  });

  describe('PROOF: Valid canonical path creates VerifiedCanonicalPath', () => {
    it('MUST succeed when complete canonical path is valid', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();

      const result = await emitStartAttestation({
        recognition,
        acceptance,
        actualStartDate: '2025-01-15T08:00:00.000Z',
        employerDid: EMPLOYER_DID,
        signingKey: mockSigningKey,
      });

      // Verify result contains VerifiedCanonicalPath
      expect(result.verifiedPath).toBeDefined();
      expect(result.verifiedPath.recognition).toBe(recognition);
      expect(result.verifiedPath.acceptance).toBe(acceptance);
      expect(result.verifiedPath.start).toBeDefined();

      // Verify start attestation was created
      expect(result.startAttestation).toBeDefined();
      expect(result.startAttestation.recognitionId).toBe(RECOGNITION_ID);
      expect(result.startAttestation.acceptanceId).toBe(ACCEPTANCE_ID);
      expect(result.startAttestation.employerDid).toBe(EMPLOYER_DID);
      expect(result.startAttestation.practitionerDid).toBe(PRACTITIONER_DID);
      expect(result.startAttestation.roleId).toBe(ROLE_ID);
      expect(result.startAttestation.actualStartDate).toBe('2025-01-15T08:00:00.000Z');

      // Verify proof is employer-signed
      expect(result.startAttestation.proof.verificationMethod).toBe(
        mockSigningKey.verificationMethod,
      );
      expect(result.startAttestation.proof.type).toBe('Ed25519Signature2020');

      // Verify immutability anchors
      expect(result.startAttestation.hashAnchor).toBeDefined();
      expect(result.canonicalPathHash).toBeDefined();
    });

    it('MUST create deterministic attestationId for same inputs', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();

      const result1 = await emitStartAttestation({
        recognition,
        acceptance,
        actualStartDate: '2025-01-15T08:00:00.000Z',
        employerDid: EMPLOYER_DID,
        signingKey: mockSigningKey,
      });

      const result2 = await emitStartAttestation({
        recognition,
        acceptance,
        actualStartDate: '2025-01-15T08:00:00.000Z',
        employerDid: EMPLOYER_DID,
        signingKey: mockSigningKey,
      });

      // attestationId should be deterministic
      expect(result1.startAttestation.attestationId).toBe(result2.startAttestation.attestationId);
    });

    it('MUST include employment details from acceptance terms', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();

      const result = await emitStartAttestation({
        recognition,
        acceptance,
        actualStartDate: '2025-01-15T08:00:00.000Z',
        employerDid: EMPLOYER_DID,
        signingKey: mockSigningKey,
      });

      expect(result.startAttestation.employmentDetails).toEqual({
        roleTitle: 'General Surgeon',
        department: 'Surgery',
        schedule: 'full-time',
      });
      expect(result.startAttestation.facilityId).toBe(acceptance.facilityId);
    });

    it('MUST allow custom employment details override', async () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();

      const result = await emitStartAttestation({
        recognition,
        acceptance,
        actualStartDate: '2025-01-15T08:00:00.000Z',
        employerDid: EMPLOYER_DID,
        signingKey: mockSigningKey,
        employmentDetails: {
          roleTitle: 'Senior Surgeon',
          department: 'Trauma Surgery',
          schedule: 'part-time',
        },
      });

      expect(result.startAttestation.employmentDetails).toEqual({
        roleTitle: 'Senior Surgeon',
        department: 'Trauma Surgery',
        schedule: 'part-time',
      });
      expect(result.startAttestation.facilityId).toBe(acceptance.facilityId);
    });
  });

  describe('PROOF: canEmitStartAttestation() pre-check', () => {
    it('MUST return false when recognition is missing', () => {
      const acceptance = createValidAcceptance();
      expect(canEmitStartAttestation(null, acceptance)).toBe(false);
    });

    it('MUST return false when acceptance is missing', () => {
      const recognition = createValidRecognition();
      expect(canEmitStartAttestation(recognition, null)).toBe(false);
    });

    it('MUST return false when both are missing', () => {
      expect(canEmitStartAttestation(null, null)).toBe(false);
    });

    it('MUST return true when both recognition and acceptance exist', () => {
      const recognition = createValidRecognition();
      const acceptance = createValidAcceptance();
      expect(canEmitStartAttestation(recognition, acceptance)).toBe(true);
    });
  });
});
