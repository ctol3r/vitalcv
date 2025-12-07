/**
 * Unit tests for CAQH mapper
 * S72-STRETCH-C-002: Tests for CAQH profile → enrollment draft prefill mapping
 */

import { describe, expect, it } from '@jest/globals';
import {
  createEnrollmentDraftFromPrefill,
  mapCaqhProfileToEnrollmentDraft,
  validateEnrollmentPrefill,
} from '../caqhMapper.js';
import { MOCK_CAQH_PROFILE } from '../caqhClient.js';

describe('CAQH Mapper', () => {
  describe('mapCaqhProfileToEnrollmentDraft', () => {
    it('should map CAQH profile to enrollment draft prefill', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      expect(prefill).toBeDefined();
      expect(prefill.licenses).toBeDefined();
      expect(prefill.licenses.length).toBeGreaterThan(0);
      expect(prefill.specialties).toBeDefined();
      expect(prefill.practiceLocations).toBeDefined();
    });

    it('should map licenses correctly', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      expect(prefill.licenses.length).toBeGreaterThan(0);
      const license = prefill.licenses[0];
      expect(license.licenseNumber).toBeDefined();
      expect(license.state).toBeDefined();
      expect(license.licenseType).toBeDefined();
      expect(license.status).toBeDefined();
    });

    it('should map board certifications to specialties', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      if (MOCK_CAQH_PROFILE.profile.boardCertifications.length > 0) {
        expect(prefill.specialties.length).toBeGreaterThan(0);
        const specialty = prefill.specialties[0];
        expect(specialty.taxonomyCode).toBeDefined();
        expect(specialty.specialty).toBeDefined();
        expect(specialty.boardCertified).toBe(true);
      }
    });

    it('should map work history to practice locations', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      if (MOCK_CAQH_PROFILE.profile.workHistory.length > 0) {
        expect(prefill.practiceLocations.length).toBeGreaterThan(0);
        const location = prefill.practiceLocations[0];
        expect(location.name).toBeDefined();
        expect(location.address).toBeDefined();
      }
    });

    it('should include metadata (education, malpractice)', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      expect(prefill.metadata).toBeDefined();
      if (MOCK_CAQH_PROFILE.profile.education) {
        expect(prefill.metadata?.education).toBeDefined();
      }
      if (MOCK_CAQH_PROFILE.profile.malpracticeInsurance) {
        expect(prefill.metadata?.malpracticeInsurance).toBeDefined();
      }
    });

    it('should create addresses from licensed states', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      // Should create at least one address entry per unique licensed state
      const uniqueStates = new Set(
        MOCK_CAQH_PROFILE.profile.licenses.map((l) => l.state)
      );
      expect(prefill.addresses.length).toBeGreaterThanOrEqual(uniqueStates.size);
    });
  });

  describe('createEnrollmentDraftFromPrefill', () => {
    it('should create enrollment draft from prefill data', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);
      const baseEnrollment = {
        orgId: 'org-123',
        payerId: 'payer-456',
        clinicianDid: 'did:example:789',
        caqhId: 'CAQH123456',
      };

      const draft = createEnrollmentDraftFromPrefill(prefill, baseEnrollment);

      expect(draft.orgId).toBe(baseEnrollment.orgId);
      expect(draft.payerId).toBe(baseEnrollment.payerId);
      expect(draft.clinicianDid).toBe(baseEnrollment.clinicianDid);
      expect(draft.caqhId).toBe(baseEnrollment.caqhId);
      expect(draft.evidenceBundle).toBeDefined();
      expect(draft.metadata).toBeDefined();
    });

    it('should include prefill source in metadata', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);
      const baseEnrollment = {
        orgId: 'org-123',
        payerId: 'payer-456',
        clinicianDid: 'did:example:789',
      };

      const draft = createEnrollmentDraftFromPrefill(prefill, baseEnrollment);

      expect(draft.metadata?.prefillSource).toBe('CAQH');
      expect(draft.metadata?.prefillDate).toBeDefined();
    });
  });

  describe('validateEnrollmentPrefill', () => {
    it('should validate prefill with required fields', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);
      const result = validateEnrollmentPrefill(prefill);

      // Should be valid if CAQH profile has licenses and specialties
      if (prefill.licenses.length > 0 && prefill.specialties.length > 0) {
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      }
    });

    it('should fail validation if no licenses', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);
      prefill.licenses = [];

      const result = validateEnrollmentPrefill(prefill);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one license is required');
    });

    it('should fail validation if no active licenses', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);
      // Set all licenses to expired
      prefill.licenses = prefill.licenses.map((l) => ({
        ...l,
        status: 'Expired' as const,
        expirationDate: new Date(Date.now() - 1000).toISOString(),
      }));

      const result = validateEnrollmentPrefill(prefill);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one active license is required');
    });

    it('should fail validation if no specialties', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);
      prefill.specialties = [];

      const result = validateEnrollmentPrefill(prefill);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one specialty is required');
    });
  });

  describe('Specialty taxonomy mapping', () => {
    it('should map common specialties to taxonomy codes', () => {
      const prefill = mapCaqhProfileToEnrollmentDraft(MOCK_CAQH_PROFILE);

      // Check that specialties have taxonomy codes
      prefill.specialties.forEach((spec) => {
        expect(spec.taxonomyCode).toBeDefined();
        expect(spec.taxonomyCode).toMatch(/^\d{10}[A-Z]$/); // Format: 10 digits + 1 letter
      });
    });
  });
});

