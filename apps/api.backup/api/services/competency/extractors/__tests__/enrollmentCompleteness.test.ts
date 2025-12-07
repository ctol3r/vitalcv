/**
 * Tests for EnrollmentCompletenessCalculator
 */

import { describe, expect, it } from '@jest/globals';
import {
  enrollmentCompletenessCalculator,
  type MedicaidEnrollment,
  type PECOSEnrollment,
  type PayerEnrollment,
} from '../enrollmentCompleteness.js';

describe('EnrollmentCompletenessCalculator', () => {
  describe('calculate', () => {
    it('should score complete enrollment', () => {
      const result = enrollmentCompletenessCalculator.calculate({
        pecos: {
          status: 'ENROLLED',
        } as PECOSEnrollment,
        payers: [
          {
            payerId: 'payer-1',
            payerName: 'Medicare',
            status: 'ENROLLED',
            isRequired: true,
          } as PayerEnrollment,
        ],
      });

      expect(result.completeness).toBeGreaterThan(0.5);
      expect(result.pecosScore).toBe(1.0);
      expect(result.payerScore).toBeGreaterThan(0);
      expect(result.missingRequiredPayers).toHaveLength(0);
    });

    it('should penalize missing required payers', () => {
      const result = enrollmentCompletenessCalculator.calculate({
        pecos: {
          status: 'ENROLLED',
        } as PECOSEnrollment,
        payers: [
          {
            payerId: 'payer-1',
            payerName: 'Medicare',
            status: 'PENDING',
            isRequired: true,
          } as PayerEnrollment,
          {
            payerId: 'payer-2',
            payerName: 'Medicaid',
            status: 'REJECTED',
            isRequired: true,
          } as PayerEnrollment,
        ],
      });

      expect(result.completeness).toBeLessThan(0.5);
      expect(result.missingRequiredPayers.length).toBeGreaterThan(0);
    });

    it('should handle expired PECOS', () => {
      const expiredDate = new Date();
      expiredDate.setFullYear(expiredDate.getFullYear() - 1);

      const result = enrollmentCompletenessCalculator.calculate({
        pecos: {
          status: 'ENROLLED',
          expiryDate: expiredDate,
        } as PECOSEnrollment,
      });

      expect(result.pecosScore).toBeLessThan(1.0);
    });

    it('should score PECOS statuses correctly', () => {
      const enrolled = enrollmentCompletenessCalculator.calculate({
        pecos: { status: 'ENROLLED' } as PECOSEnrollment,
      });
      expect(enrolled.pecosScore).toBe(1.0);

      const pending = enrollmentCompletenessCalculator.calculate({
        pecos: { status: 'PENDING' } as PECOSEnrollment,
      });
      expect(pending.pecosScore).toBe(0.5);

      const deactivated = enrollmentCompletenessCalculator.calculate({
        pecos: { status: 'DEACTIVATED' } as PECOSEnrollment,
      });
      expect(deactivated.pecosScore).toBe(0.0);
    });

    it('should handle empty enrollment data', () => {
      const result = enrollmentCompletenessCalculator.calculate({});

      expect(result.completeness).toBe(0);
      expect(result.pecosScore).toBe(0);
      expect(result.medicaidScore).toBe(0);
      expect(result.payerScore).toBe(0);
    });

    it('should weight required payers more heavily', () => {
      const withRequired: PayerEnrollment[] = [
        {
          payerId: 'payer-1',
          payerName: 'Required Payer',
          status: 'ENROLLED',
          isRequired: true,
        },
        {
          payerId: 'payer-2',
          payerName: 'Optional Payer',
          status: 'PENDING',
          isRequired: false,
        },
      ];

      const result = enrollmentCompletenessCalculator.calculate({
        payers: withRequired,
      });

      // Should have decent score because required payer is enrolled
      expect(result.completeness).toBeGreaterThan(0.5);
    });

    describe('Medicaid enrollment', () => {
      it('should handle expired Medicaid enrollment', () => {
        const expiredDate = new Date();
        expiredDate.setFullYear(expiredDate.getFullYear() - 1);

        const result = enrollmentCompletenessCalculator.calculate({
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
              expiryDate: expiredDate,
            } as MedicaidEnrollment,
          ],
        });

        // Expired Medicaid should reduce score (counts as pending)
        expect(result.medicaidScore).toBeLessThan(1.0);
        expect(result.medicaidScore).toBeGreaterThan(0);
        expect(result.breakdown.medicaid.enrolledStates).toBe(0);
      });

      it('should penalize missing required Medicaid', () => {
        // Clinician practices in CA and NY but only enrolled in CA
        const result = enrollmentCompletenessCalculator.calculate({
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'REJECTED', // Required but missing
            } as MedicaidEnrollment,
          ],
        });

        // Should have lower score due to missing NY enrollment
        expect(result.medicaidScore).toBeLessThan(1.0);
        expect(result.breakdown.medicaid.enrolledStates).toBe(1);
        expect(result.breakdown.medicaid.totalStates).toBe(2);
      });

      it('should score multiple state Medicaid enrollments', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'ENROLLED',
            } as MedicaidEnrollment,
            {
              state: 'TX',
              status: 'PENDING',
            } as MedicaidEnrollment,
          ],
        });

        expect(result.medicaidScore).toBeGreaterThan(0);
        expect(result.breakdown.medicaid.totalStates).toBe(3);
        expect(result.breakdown.medicaid.enrolledStates).toBe(2);
      });
    });

    describe('Payer failure reasons', () => {
      it('should identify payer failure reasons in missing required payers', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'REJECTED',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Blue Cross',
              status: 'PANEL_FULL',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-3',
              payerName: 'Aetna',
              status: 'PENDING',
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        // All required payers are missing
        expect(result.missingRequiredPayers.length).toBe(3);
        expect(result.missingRequiredPayers).toContain('Medicare');
        expect(result.missingRequiredPayers).toContain('Blue Cross');
        expect(result.missingRequiredPayers).toContain('Aetna');
        expect(result.payerScore).toBeLessThan(0.5);
      });

      it('should handle expired payer enrollments', () => {
        const expiredDate = new Date();
        expiredDate.setMonth(expiredDate.getMonth() - 1);

        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              expiryDate: expiredDate,
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        // Expired enrollment should be treated as missing
        expect(result.missingRequiredPayers.length).toBeGreaterThan(0);
        expect(result.payerScore).toBeLessThan(1.0);
      });
    });

    describe('Updated weight rules', () => {
      it('should apply correct weights: PECOS 25%, Medicaid 15%, Payers 40%, Freshness 10%, Coverage 10%', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          pecos: { status: 'ENROLLED' } as PECOSEnrollment,
          medicaid: [{ state: 'CA', status: 'ENROLLED' } as MedicaidEnrollment],
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        // Verify individual scores
        expect(result.pecosScore).toBe(1.0);
        expect(result.medicaidScore).toBe(1.0);
        expect(result.payerScore).toBe(1.0);
        expect(result.enrollmentFreshness).toBe(1.0);
        expect(result.enrollmentCoverageScore).toBe(0.5); // No region data = neutral

        // Overall completeness should be weighted average
        // 1.0 * 0.25 + 1.0 * 0.15 + 1.0 * 0.4 + 1.0 * 0.1 + 0.5 * 0.1 = 0.95
        expect(result.completeness).toBeCloseTo(0.95, 2);
      });

      it('should reflect payer weight dominance in overall score', () => {
        const resultWithGoodPayers = enrollmentCompletenessCalculator.calculate({
          pecos: { status: 'PENDING' } as PECOSEnrollment, // 0.5
          medicaid: [], // 0
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        const resultWithBadPayers = enrollmentCompletenessCalculator.calculate({
          pecos: { status: 'ENROLLED' } as PECOSEnrollment, // 1.0
          medicaid: [{ state: 'CA', status: 'ENROLLED' } as MedicaidEnrollment], // 1.0
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'REJECTED',
              isRequired: true,
            } as PayerEnrollment,
          ], // 0
        });

        // Good payers should result in higher score despite poor PECOS
        expect(resultWithGoodPayers.completeness).toBeGreaterThan(resultWithBadPayers.completeness);
      });
    });

    describe('Classification outputs', () => {
      it('should provide breakdown classification for PECOS', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          pecos: { status: 'ENROLLED' } as PECOSEnrollment,
        });

        expect(result.breakdown.pecos).toBeDefined();
        expect(result.breakdown.pecos.status).toBe('ENROLLED');
        expect(result.breakdown.pecos.score).toBe(1.0);
      });

      it('should provide breakdown classification for Medicaid', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          medicaid: [
            { state: 'CA', status: 'ENROLLED' } as MedicaidEnrollment,
            { state: 'NY', status: 'ENROLLED' } as MedicaidEnrollment,
          ],
        });

        expect(result.breakdown.medicaid).toBeDefined();
        expect(result.breakdown.medicaid.enrolledStates).toBe(2);
        expect(result.breakdown.medicaid.totalStates).toBe(2);
        expect(result.breakdown.medicaid.score).toBe(1.0);
      });

      it('should provide breakdown classification for payers', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Aetna',
              status: 'ENROLLED',
              isRequired: false,
            } as PayerEnrollment,
          ],
        });

        expect(result.breakdown.payers).toBeDefined();
        expect(result.breakdown.payers.enrolled).toBe(2);
        expect(result.breakdown.payers.required).toBe(1);
        expect(result.breakdown.payers.total).toBe(2);
        expect(result.breakdown.payers.score).toBeGreaterThan(0);
      });
    });

    describe('Alignment and coverage', () => {
      it('should handle region coverage penalty for missing regional payers', () => {
        // Clinician in region with 3 major payers, but only enrolled in 1
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Regional Payer A',
              status: 'ENROLLED',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Regional Payer B',
              status: 'PENDING',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-3',
              payerName: 'Regional Payer C',
              status: 'REJECTED',
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        // Should have lower score due to incomplete regional coverage
        expect(result.payerScore).toBeLessThan(0.5);
        expect(result.missingRequiredPayers.length).toBe(2);
        expect(result.completeness).toBeLessThan(0.5);
      });

      it('should detect alignment mismatch when required payers are not aligned with practice', () => {
        // Practice requires specific payers but they're not enrolled
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Required Payer A',
              status: 'REJECTED',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Required Payer B',
              status: 'PANEL_FULL',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-3',
              payerName: 'Optional Payer',
              status: 'ENROLLED',
              isRequired: false,
            } as PayerEnrollment,
          ],
        });

        // Alignment mismatch: required payers missing but optional enrolled
        expect(result.missingRequiredPayers.length).toBe(2);
        expect(result.breakdown.payers.enrolled).toBe(1);
        expect(result.breakdown.payers.required).toBe(2);
        // Score should be low due to missing required payers
        expect(result.payerScore).toBeLessThan(0.4);
      });
    });

    describe('Freshness penalties', () => {
      it('should apply freshness penalty for expiring soon enrollments', () => {
        const expiringSoon = new Date();
        expiringSoon.setDate(expiringSoon.getDate() + 30); // 30 days from now

        const result = enrollmentCompletenessCalculator.calculate({
          pecos: {
            status: 'ENROLLED',
            expiryDate: expiringSoon,
          } as PECOSEnrollment,
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              expiryDate: expiringSoon,
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        // PECOS not expired yet, so should still be 1.0
        expect(result.pecosScore).toBe(1.0);
        // Payer not expired yet, so should still count as enrolled
        expect(result.payerScore).toBeGreaterThan(0);
      });

      it('should handle mixed freshness states', () => {
        const expired = new Date();
        expired.setFullYear(expired.getFullYear() - 1);
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);

        const result = enrollmentCompletenessCalculator.calculate({
          pecos: {
            status: 'ENROLLED',
            expiryDate: expired,
          } as PECOSEnrollment,
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
              expiryDate: expired,
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'ENROLLED',
              expiryDate: future,
            } as MedicaidEnrollment,
          ],
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              expiryDate: future,
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        // PECOS expired
        expect(result.pecosScore).toBe(0.3);
        // Medicaid: 1 expired, 1 active
        expect(result.medicaidScore).toBeLessThan(1.0);
        expect(result.breakdown.medicaid.enrolledStates).toBe(1);
        // Payer still active
        expect(result.payerScore).toBeGreaterThan(0);
      });

      // B212A-ENROLL-003: Test enrollment freshness metric
      it('should apply freshness penalty if lastUpdated > 6 months', () => {
        const sevenMonthsAgo = new Date();
        sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              lastUpdated: sevenMonthsAgo,
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        expect(result.enrollmentFreshness).toBeLessThan(1.0);
        expect(result.breakdown.freshness).toBeDefined();
        expect(result.breakdown.freshness.staleCount).toBeGreaterThan(0);
        expect(result.breakdown.freshness.penalty).toBeGreaterThan(0);
      });

      it('should not apply freshness penalty if lastUpdated < 6 months', () => {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
              lastUpdated: threeMonthsAgo,
              isRequired: true,
            } as PayerEnrollment,
          ],
        });

        expect(result.enrollmentFreshness).toBe(1.0);
        expect(result.breakdown.freshness.staleCount).toBe(0);
      });
    });

    // B212A-ENROLL-004: Test failure classification arrays
    describe('Failure classification', () => {
      it('should identify expired PECOS', () => {
        const expiredDate = new Date();
        expiredDate.setFullYear(expiredDate.getFullYear() - 1);

        const result = enrollmentCompletenessCalculator.calculate({
          pecos: {
            status: 'ENROLLED',
            expiryDate: expiredDate,
          } as PECOSEnrollment,
        });

        expect(result.expiredPECOS).toBe(true);
      });

      it('should classify payer failures with reasons', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'REJECTED',
              failureReason: 'MISSING_DOCS',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Aetna',
              status: 'PANEL_FULL',
              failureReason: 'PAYER_PANEL_FULL',
              isRequired: false,
            } as PayerEnrollment,
          ],
        });

        expect(result.payerFailures.length).toBeGreaterThan(0);
        expect(result.payerFailures.some((f) => f.reason === 'MISSING_DOCS')).toBe(true);
        expect(result.payerFailures.some((f) => f.reason === 'PAYER_PANEL_FULL')).toBe(true);
      });

      it('should identify Medicaid gaps for required states', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
              required: true,
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'REJECTED',
              required: true,
            } as MedicaidEnrollment,
            {
              state: 'TX',
              status: 'PENDING',
              required: true,
            } as MedicaidEnrollment,
          ],
        });

        expect(result.medicaidGaps.length).toBeGreaterThan(0);
        expect(result.medicaidGaps).toContain('NY');
        expect(result.medicaidGaps).toContain('TX');
      });

      it('should identify alignment failures between Medicaid and PECOS', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          pecos: {
            status: 'ENROLLED',
          } as PECOSEnrollment,
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
              pecosAligned: true,
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'ENROLLED',
              pecosAligned: false,
            } as MedicaidEnrollment,
          ],
        });

        expect(result.alignmentFailures.length).toBeGreaterThan(0);
        expect(result.alignmentFailures).toContain('NY');
      });

      it('should populate missingPayers array', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'REJECTED',
              isRequired: true,
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Aetna',
              status: 'ENROLLED',
              isRequired: false,
            } as PayerEnrollment,
          ],
        });

        expect(result.missingPayers).toContain('Medicare');
        expect(result.missingPayers).not.toContain('Aetna');
      });
    });

    // B212A-ENROLL-005: Test enrollment coverage score
    describe('Enrollment coverage score', () => {
      it('should calculate coverage score based on region payer distribution', () => {
        const regionDistribution = {
          'payer-1': 0.4, // 40% of region
          'payer-2': 0.3, // 30% of region
          'payer-3': 0.3, // 30% of region
        };

        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Regional Payer A',
              status: 'ENROLLED',
            } as PayerEnrollment,
            {
              payerId: 'payer-2',
              payerName: 'Regional Payer B',
              status: 'ENROLLED',
            } as PayerEnrollment,
            // payer-3 missing
          ],
          regionPayerDistribution: regionDistribution,
        });

        expect(result.enrollmentCoverageScore).toBeGreaterThan(0);
        expect(result.breakdown.coverage).toBeDefined();
        expect(result.breakdown.coverage.coverageRatio).toBeGreaterThan(0);
        expect(result.breakdown.coverage.regionMatch).toBeGreaterThan(0);
      });

      it('should return neutral score when no region data provided', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Medicare',
              status: 'ENROLLED',
            } as PayerEnrollment,
          ],
        });

        expect(result.enrollmentCoverageScore).toBe(0.5);
        expect(result.breakdown.coverage.coverageRatio).toBe(0);
        expect(result.breakdown.coverage.regionMatch).toBe(0);
      });

      it('should weight coverage by region distribution', () => {
        const regionDistribution = {
          'payer-1': 0.8, // 80% of region (major payer)
          'payer-2': 0.2, // 20% of region (minor payer)
        };

        // Only enrolled in minor payer
        const resultMinor = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-2',
              payerName: 'Minor Payer',
              status: 'ENROLLED',
            } as PayerEnrollment,
          ],
          regionPayerDistribution: regionDistribution,
        });

        // Only enrolled in major payer
        const resultMajor = enrollmentCompletenessCalculator.calculate({
          payers: [
            {
              payerId: 'payer-1',
              payerName: 'Major Payer',
              status: 'ENROLLED',
            } as PayerEnrollment,
          ],
          regionPayerDistribution: regionDistribution,
        });

        // Major payer enrollment should have higher region match
        expect(resultMajor.breakdown.coverage.regionMatch).toBeGreaterThan(
          resultMinor.breakdown.coverage.regionMatch
        );
      });
    });

    // B212A-ENROLL-002: Test MedicaidEnrollment with required and pecosAligned
    describe('Medicaid enrollment enhancements', () => {
      it('should handle required Medicaid state enrollments', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
              required: true,
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'PENDING',
              required: true,
            } as MedicaidEnrollment,
          ],
        });

        expect(result.medicaidScore).toBeGreaterThan(0);
        expect(result.breakdown.medicaid.totalStates).toBe(2);
      });

      it('should check PECOS alignment for Medicaid enrollments', () => {
        const result = enrollmentCompletenessCalculator.calculate({
          pecos: {
            status: 'ENROLLED',
          } as PECOSEnrollment,
          medicaid: [
            {
              state: 'CA',
              status: 'ENROLLED',
              pecosAligned: true,
            } as MedicaidEnrollment,
            {
              state: 'NY',
              status: 'ENROLLED',
              pecosAligned: false,
            } as MedicaidEnrollment,
          ],
        });

        expect(result.alignmentFailures).toContain('NY');
        expect(result.alignmentFailures).not.toContain('CA');
      });
    });
  });
});
