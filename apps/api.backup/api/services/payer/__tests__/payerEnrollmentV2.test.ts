import { describe, expect, it } from '@jest/globals';
import {
  PAYER_ENROLLMENT_V2_TERMINAL_STATUSES,
  canTransitionPayerEnrollmentV2,
  getPayerEnrollmentV2StatusCategory,
  isTerminalPayerEnrollmentV2Status,
  normalizePanelType,
  validateCreatePayerEnrollmentV2,
  validateUpdatePayerEnrollmentV2,
} from '../models/PayerEnrollmentV2.js';

describe('PayerEnrollmentV2 model', () => {
  describe('validateCreatePayerEnrollmentV2', () => {
    it('accepts the minimal payload and sets defaults', () => {
      const result = validateCreatePayerEnrollmentV2({
        clinicianId: 'clinician-123',
        payerId: 'payer-abc',
      });

      expect(result.status).toBe('PENDING');
      expect(result.panelType).toBe('OPEN');
      expect(result.effectiveDate).toBeUndefined();
    });

    it('coerces ISO strings and normalizes panel types', () => {
      const result = validateCreatePayerEnrollmentV2({
        clinicianId: 'clinician-123',
        payerId: 'payer-abc',
        effectiveDate: '2025-01-15T00:00:00.000Z',
        panelType: 'medicaid managed',
        status: 'ATTEMPTING',
      });

      expect(result.effectiveDate).toBeInstanceOf(Date);
      expect(result.panelType).toBe('MEDICAID_MANAGED');
      expect(result.status).toBe('ATTEMPTING');
    });

    it('rejects unsupported statuses', () => {
      expect(() =>
        validateCreatePayerEnrollmentV2({
          clinicianId: 'c1',
          payerId: 'p1',
          status: 'UNKNOWN',
        })
      ).toThrow(/Invalid enum value/);
    });
  });

  describe('validateUpdatePayerEnrollmentV2', () => {
    it('requires at least one field', () => {
      expect(() => validateUpdatePayerEnrollmentV2({})).toThrow(/At least one field/);
    });

    it('normalizes updates and coerces types', () => {
      const result = validateUpdatePayerEnrollmentV2({
        panelType: 'Limited',
        effectiveDate: '2024-12-01',
        status: 'ENROLLED',
      });

      expect(result.panelType).toBe('LIMITED');
      expect(result.effectiveDate).toBeInstanceOf(Date);
      expect(result.status).toBe('ENROLLED');
    });
  });

  describe('status helpers', () => {
    it('exposes terminal state helper', () => {
      for (const status of PAYER_ENROLLMENT_V2_TERMINAL_STATUSES) {
        expect(isTerminalPayerEnrollmentV2Status(status)).toBe(true);
      }

      expect(isTerminalPayerEnrollmentV2Status('ATTEMPTING')).toBe(false);
    });

    it('computes status categories', () => {
      expect(getPayerEnrollmentV2StatusCategory('PENDING')).toBe('in_progress');
      expect(getPayerEnrollmentV2StatusCategory('REVALIDATION_DUE')).toBe('action_required');
      expect(getPayerEnrollmentV2StatusCategory('ENROLLED')).toBe('active');
    });

    it('enforces allowed transitions', () => {
      expect(canTransitionPayerEnrollmentV2('PENDING', 'ATTEMPTING')).toBe(true);
      expect(canTransitionPayerEnrollmentV2('ENROLLED', 'PENDING')).toBe(false);
      expect(canTransitionPayerEnrollmentV2('REVALIDATION_DUE', 'ATTEMPTING')).toBe(true);
    });
  });

  describe('normalizePanelType', () => {
    it('maps fuzzy strings to canonical buckets', () => {
      expect(normalizePanelType('open access')).toBe('OPEN');
      expect(normalizePanelType('Closed panel')).toBe('CLOSED');
      expect(normalizePanelType('medicare advantage dsnp')).toBe('MEDICARE_ADVANTAGE');
      expect(normalizePanelType('sub-specialty')).toBe('SPECIALTY');
      expect(normalizePanelType('unknown value')).toBe('OPEN');
    });
  });
});

