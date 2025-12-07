/**
 * S72-STRETCH-D-001: Unit tests for MatchingConfig & FeatureWeights
 */

import { describe, it, expect } from '@jest/globals';
import {
  FeatureWeightsSchema,
  DEFAULT_FEATURE_WEIGHTS,
  validateWeightsSum,
  normalizeWeights,
} from '../models/MatchingConfig';

describe('MatchingConfig', () => {
  describe('FeatureWeightsSchema', () => {
    it('should validate default weights', () => {
      const result = FeatureWeightsSchema.parse(DEFAULT_FEATURE_WEIGHTS);
      expect(result).toEqual(DEFAULT_FEATURE_WEIGHTS);
    });

    it('should reject weights outside [0, 1]', () => {
      expect(() => {
        FeatureWeightsSchema.parse({
          specialtyMatch: 1.5,
          locationProximity: 0.25,
          experienceYears: 0.20,
          rating: 0.15,
          burnoutRisk: 0.05,
        });
      }).toThrow();

      expect(() => {
        FeatureWeightsSchema.parse({
          specialtyMatch: -0.1,
          locationProximity: 0.25,
          experienceYears: 0.20,
          rating: 0.15,
          burnoutRisk: 0.05,
        });
      }).toThrow();
    });

    it('should use defaults for missing fields', () => {
      const result = FeatureWeightsSchema.parse({});
      expect(result.specialtyMatch).toBe(DEFAULT_FEATURE_WEIGHTS.specialtyMatch);
    });
  });

  describe('validateWeightsSum', () => {
    it('should return true for weights that sum to 1.0', () => {
      const weights = {
        specialtyMatch: 0.35,
        locationProximity: 0.25,
        experienceYears: 0.20,
        rating: 0.15,
        burnoutRisk: 0.05,
      };
      expect(validateWeightsSum(weights)).toBe(true);
    });

    it('should return false for weights that do not sum to 1.0', () => {
      const weights = {
        specialtyMatch: 0.5,
        locationProximity: 0.5,
        experienceYears: 0.5,
        rating: 0.5,
        burnoutRisk: 0.5,
      };
      expect(validateWeightsSum(weights)).toBe(false);
    });

    it('should allow small floating point errors', () => {
      const weights = {
        specialtyMatch: 0.3500001,
        locationProximity: 0.25,
        experienceYears: 0.20,
        rating: 0.15,
        burnoutRisk: 0.05,
      };
      expect(validateWeightsSum(weights)).toBe(true);
    });
  });

  describe('normalizeWeights', () => {
    it('should normalize weights to sum to 1.0', () => {
      const weights = {
        specialtyMatch: 0.5,
        locationProximity: 0.5,
        experienceYears: 0.5,
        rating: 0.5,
        burnoutRisk: 0.5,
      };
      const normalized = normalizeWeights(weights);
      expect(validateWeightsSum(normalized)).toBe(true);
    });

    it('should preserve relative proportions', () => {
      const weights = {
        specialtyMatch: 0.7,
        locationProximity: 0.3,
        experienceYears: 0.2,
        rating: 0.1,
        burnoutRisk: 0.1,
      };
      const normalized = normalizeWeights(weights);
      // Specialty should still be highest
      expect(normalized.specialtyMatch).toBeGreaterThan(normalized.locationProximity);
    });

    it('should return default weights for zero sum', () => {
      const weights = {
        specialtyMatch: 0,
        locationProximity: 0,
        experienceYears: 0,
        rating: 0,
        burnoutRisk: 0,
      };
      const normalized = normalizeWeights(weights);
      expect(normalized).toEqual(DEFAULT_FEATURE_WEIGHTS);
    });
  });
});

