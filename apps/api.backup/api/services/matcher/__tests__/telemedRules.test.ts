/**
 * B132A-TELEMED-014: Tests for telehealth eligibility rules
 */

import {
  checkTelehealthEligibility,
  getTelehealthCoverageStates,
  isValidImlcCombination,
  calculateTelehealthReachScore,
  IMLC_STATES,
} from '../telemedRules';
import { JobMatchCriteria } from '../../jobs/models/JobPosting';

describe('Telehealth Eligibility Rules', () => {
  describe('IMLC eligibility', () => {
    it('should be eligible with IMLC membership for IMLC states', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['TX'], // Has TX license
        imlcMember: true,
      };

      const result = checkTelehealthEligibility(criteria, ['CA', 'NY', 'FL']);

      expect(result.eligible).toBe(true);
      expect(result.method).toBe('imlc');
      expect(result.coveredStates.length).toBeGreaterThan(0);
    });

    it('should not be eligible via IMLC without membership', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['TX'],
        imlcMember: false,
      };

      const result = checkTelehealthEligibility(criteria, ['CA', 'NY']);

      // Should fall back to other methods or not eligible
      expect(result.method).not.toBe('imlc');
    });

    it('should validate IMLC state combinations', () => {
      const imlcStates = ['CA', 'NY', 'TX', 'FL'];
      const mixedStates = ['CA', 'HI', 'NY']; // HI not in IMLC

      expect(isValidImlcCombination(imlcStates)).toBe(true);
      expect(isValidImlcCombination(mixedStates)).toBe(false);
    });
  });

  describe('multi-state licenses', () => {
    it('should be eligible with multi-state licenses', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['TX'],
        multiStateLicenses: ['CA', 'NY', 'FL'],
      };

      const result = checkTelehealthEligibility(criteria, ['CA', 'NY']);

      expect(result.eligible).toBe(true);
      expect(result.method).toBe('multi-state');
      expect(result.coveredStates).toEqual(['CA', 'NY']);
    });
  });

  describe('single-state licenses', () => {
    it('should be eligible with direct license in required state', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA', 'NY'],
      };

      const result = checkTelehealthEligibility(criteria, ['CA']);

      expect(result.eligible).toBe(true);
      expect(result.method).toBe('single-state');
      expect(result.coveredStates).toEqual(['CA']);
    });

    it('should not be eligible without required license', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['TX'],
      };

      const result = checkTelehealthEligibility(criteria, ['CA', 'NY']);

      expect(result.eligible).toBe(false);
      expect(result.method).toBe('not-eligible');
    });
  });

  describe('telehealth coverage', () => {
    it('should calculate coverage states correctly', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['TX', 'NY'],
        multiStateLicenses: ['CA'],
      };

      const coverageStates = getTelehealthCoverageStates(criteria);

      expect(coverageStates).toContain('TX');
      expect(coverageStates).toContain('NY');
      expect(coverageStates).toContain('CA');
    });

    it('should include all IMLC states for IMLC members', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['TX'],
        imlcMember: true,
      };

      const coverageStates = getTelehealthCoverageStates(criteria);

      // Should include all IMLC states
      expect(coverageStates.length).toBeGreaterThanOrEqual(IMLC_STATES.size);

      // Check some IMLC states are included
      expect(coverageStates).toContain('CA');
      expect(coverageStates).toContain('NY');
      expect(coverageStates).toContain('TX');
    });

    it('should calculate reach score', () => {
      const limitedCriteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA'],
      };

      const wideCriteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA'],
        imlcMember: true,
      };

      const limitedScore = calculateTelehealthReachScore(limitedCriteria);
      const wideScore = calculateTelehealthReachScore(wideCriteria);

      expect(wideScore).toBeGreaterThan(limitedScore);
      expect(limitedScore).toBeGreaterThan(0);
      expect(wideScore).toBeLessThanOrEqual(1);
    });
  });

  describe('IMLC state combinations', () => {
    it('should validate common IMLC state pairs', () => {
      // Common telehealth state combinations
      const commonPairs = [
        ['CA', 'TX'],
        ['NY', 'FL'],
        ['WA', 'CO'],
      ];

      commonPairs.forEach(pair => {
        expect(isValidImlcCombination(pair)).toBe(true);
      });
    });

    it('should reject non-IMLC states', () => {
      const nonImlcStates = ['CA', 'HI']; // HI not in IMLC
      expect(isValidImlcCombination(nonImlcStates)).toBe(false);
    });
  });
});

