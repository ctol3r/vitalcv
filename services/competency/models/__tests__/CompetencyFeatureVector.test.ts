/**
 * Tests for CompetencyFeatureVector model
 */

import { describe, it, expect } from '@jest/globals';
import {
  createCompetencyFeatureVector,
  validateCompetencyFeatureVector,
  competencyFeatureVectorToArray,
  COMPETENCY_FEATURE_NAMES,
} from '../CompetencyFeatureVector.js';

describe('CompetencyFeatureVector', () => {
  describe('createCompetencyFeatureVector', () => {
    it('should create a valid feature vector', () => {
      const input = {
        clinicianId: 'clinician-1',
        timestamp: new Date('2025-01-01'),
        features: {
          caseVolume: 0.8,
          caseComplexityIndex: 0.6,
          complicationRate: 0.1,
          FPPE_score: 0.9,
          OPPE_trend: 0.5,
          credentialFreshness: 0.85,
          privilegeDepth: 0.4,
          privilegeBreadth: 0.7,
          enrollmentCompleteness: 0.9,
          mobilityReadiness: 0.6,
          safetyHistory: 0.95,
          driftHistory: 0.1,
          forecastRisk: 0.2,
          trainingYears: 0.75,
          boardRecency: 0.8,
        },
      };

      const vector = createCompetencyFeatureVector(input);

      expect(vector.clinicianId).toBe('clinician-1');
      expect(vector.features.caseVolume).toBe(0.8);
      expect(vector.features.FPPE_score).toBe(0.9);
      expect(vector.timestamp).toBeInstanceOf(Date);
    });

    it('should validate feature ranges', () => {
      const input = {
        clinicianId: 'clinician-1',
        features: {
          caseVolume: 1.5, // Invalid: > 1
          caseComplexityIndex: 0.5,
          complicationRate: 0.1,
          FPPE_score: 0.9,
          OPPE_trend: 0.5,
          credentialFreshness: 0.85,
          privilegeDepth: 0.4,
          privilegeBreadth: 0.7,
          enrollmentCompleteness: 0.9,
          mobilityReadiness: 0.6,
          safetyHistory: 0.95,
          driftHistory: 0.1,
          forecastRisk: 0.2,
          trainingYears: 0.75,
          boardRecency: 0.8,
        },
      };

      expect(() => createCompetencyFeatureVector(input)).toThrow();
    });

    it('should handle OPPE_trend range -1 to 1', () => {
      const input = {
        clinicianId: 'clinician-1',
        features: {
          caseVolume: 0.5,
          caseComplexityIndex: 0.5,
          complicationRate: 0.1,
          FPPE_score: 0.9,
          OPPE_trend: -0.8, // Valid negative value
          credentialFreshness: 0.85,
          privilegeDepth: 0.4,
          privilegeBreadth: 0.7,
          enrollmentCompleteness: 0.9,
          mobilityReadiness: 0.6,
          safetyHistory: 0.95,
          driftHistory: 0.1,
          forecastRisk: 0.2,
          trainingYears: 0.75,
          boardRecency: 0.8,
        },
      };

      const vector = createCompetencyFeatureVector(input);
      expect(vector.features.OPPE_trend).toBe(-0.8);
    });
  });

  describe('validateCompetencyFeatureVector', () => {
    it('should validate a valid vector', () => {
      const vector = {
        clinicianId: 'clinician-1',
        timestamp: new Date(),
        features: {
          caseVolume: 0.5,
          caseComplexityIndex: 0.5,
          complicationRate: 0.1,
          FPPE_score: 0.9,
          OPPE_trend: 0.0,
          credentialFreshness: 0.85,
          privilegeDepth: 0.4,
          privilegeBreadth: 0.7,
          enrollmentCompleteness: 0.9,
          mobilityReadiness: 0.6,
          safetyHistory: 0.95,
          driftHistory: 0.1,
          forecastRisk: 0.2,
          trainingYears: 0.75,
          boardRecency: 0.8,
        },
      };

      const validated = validateCompetencyFeatureVector(vector);
      expect(validated).toEqual(vector);
    });

    it('should reject invalid vector', () => {
      const invalid = {
        clinicianId: '', // Invalid: empty string
        timestamp: new Date(),
        features: {
          caseVolume: 0.5,
          caseComplexityIndex: 0.5,
          complicationRate: 0.1,
          FPPE_score: 0.9,
          OPPE_trend: 0.0,
          credentialFreshness: 0.85,
          privilegeDepth: 0.4,
          privilegeBreadth: 0.7,
          enrollmentCompleteness: 0.9,
          mobilityReadiness: 0.6,
          safetyHistory: 0.95,
          driftHistory: 0.1,
          forecastRisk: 0.2,
          trainingYears: 0.75,
          boardRecency: 0.8,
        },
      };

      expect(() => validateCompetencyFeatureVector(invalid)).toThrow();
    });
  });

  describe('competencyFeatureVectorToArray', () => {
    it('should convert features to array in correct order', () => {
      const features = {
        caseVolume: 0.1,
        caseComplexityIndex: 0.2,
        complicationRate: 0.3,
        FPPE_score: 0.4,
        OPPE_trend: 0.5,
        credentialFreshness: 0.6,
        privilegeDepth: 0.7,
        privilegeBreadth: 0.8,
        enrollmentCompleteness: 0.9,
        mobilityReadiness: 0.10,
        safetyHistory: 0.11,
        driftHistory: 0.12,
        forecastRisk: 0.13,
        trainingYears: 0.14,
        boardRecency: 0.15,
      };

      const array = competencyFeatureVectorToArray(features);

      expect(array).toHaveLength(15);
      expect(array[0]).toBe(0.1); // caseVolume
      expect(array[1]).toBe(0.2); // caseComplexityIndex
      expect(array[14]).toBe(0.15); // boardRecency
    });
  });

  describe('COMPETENCY_FEATURE_NAMES', () => {
    it('should have all 15 feature names', () => {
      expect(COMPETENCY_FEATURE_NAMES).toHaveLength(15);
      expect(COMPETENCY_FEATURE_NAMES).toContain('caseVolume');
      expect(COMPETENCY_FEATURE_NAMES).toContain('boardRecency');
    });
  });
});

