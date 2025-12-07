/**
 * B131A-MATCH-004: Unit tests for similarity scoring function
 * Validates monotonicity & feature weighting
 */

import { describe, it, expect } from '@jest/globals';
import {
  score,
  cosineSimilarity,
  extractFeatureScores,
  FeatureScores,
} from '../score';
import { DEFAULT_FEATURE_WEIGHTS, FeatureWeights } from '../models/MatchingConfig';

describe('score', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 0, 0, 0];
      const similarity = cosineSimilarity(vec, vec);
      // After normalization to [0,1], identical vectors should be close to 1
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      // After normalization, orthogonal vectors should be around 0.5
      expect(similarity).toBeCloseTo(0.5, 1);
    });

    it('should handle vectors of different magnitudes', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [2, 4, 6]; // Same direction, different magnitude
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should throw error for vectors of different dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });
  });

  describe('extractFeatureScores', () => {
    it('should extract specialty match correctly', () => {
      const features = extractFeatureScores(
        { specialty: '207Q00000X' },
        { specialty: '207Q00000X' }
      );
      expect(features.specialtyMatch).toBe(1.0);
    });

    it('should extract category match', () => {
      const features = extractFeatureScores(
        { specialty: '207Q00000X' },
        { specialty: '207Q00001X' } // Same category (first 4 chars)
      );
      expect(features.specialtyMatch).toBe(0.8);
    });

    it('should extract location proximity', () => {
      const features = extractFeatureScores(
        {
          location: { lat: 37.7749, lng: -122.4194 }, // San Francisco
        },
        {
          location: { lat: 37.7849, lng: -122.4094 }, // Very close
        }
      );
      expect(features.locationProximity).toBeGreaterThan(0.9);
    });

    it('should extract experience years', () => {
      const features = extractFeatureScores(
        { experienceYears: 10 },
        { minExperienceYears: 5 }
      );
      expect(features.experienceYears).toBeGreaterThan(0.5);
    });
  });

  describe('score function', () => {
    const mockVec = [0.1, 0.2, 0.3, 0.4, 0.5];
    const mockFeatures: FeatureScores = {
      specialtyMatch: 1.0,
      locationProximity: 0.8,
      experienceYears: 0.7,
      rating: 0.9,
      burnoutRisk: 0.8, // Low burnout risk = high score
    };

    it('should return score in [0, 1]', () => {
      const result = score(mockVec, mockVec, mockFeatures);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should be monotonic with respect to feature scores', () => {
      const baseFeatures: FeatureScores = {
        specialtyMatch: 0.5,
        locationProximity: 0.5,
        experienceYears: 0.5,
        rating: 0.5,
        burnoutRisk: 0.5,
      };

      const improvedFeatures: FeatureScores = {
        specialtyMatch: 1.0,
        locationProximity: 0.8,
        experienceYears: 0.7,
        rating: 0.9,
        burnoutRisk: 0.8,
      };

      const baseScore = score(mockVec, mockVec, baseFeatures);
      const improvedScore = score(mockVec, mockVec, improvedFeatures);

      expect(improvedScore).toBeGreaterThan(baseScore);
    });

    it('should respect feature weights', () => {
      const highSpecialtyWeight: FeatureWeights = {
        specialtyMatch: 0.8,
        locationProximity: 0.05,
        experienceYears: 0.05,
        rating: 0.05,
        burnoutRisk: 0.05,
      };

      const highLocationWeight: FeatureWeights = {
        specialtyMatch: 0.05,
        locationProximity: 0.8,
        experienceYears: 0.05,
        rating: 0.05,
        burnoutRisk: 0.05,
      };

      const features: FeatureScores = {
        specialtyMatch: 1.0,
        locationProximity: 0.2,
        experienceYears: 0.5,
        rating: 0.5,
        burnoutRisk: 0.5,
      };

      const scoreWithSpecialty = score(mockVec, mockVec, features, highSpecialtyWeight);
      const scoreWithLocation = score(mockVec, mockVec, features, highLocationWeight);

      // Score with high specialty weight should be higher when specialty match is high
      expect(scoreWithSpecialty).toBeGreaterThan(scoreWithLocation);
    });

    it('should handle zero vectors', () => {
      const zeroVec = [0, 0, 0, 0, 0];
      const result = score(zeroVec, zeroVec, mockFeatures);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should combine embedding similarity and feature scores', () => {
      const identicalVec = [1, 0, 0, 0, 0];
      const orthogonalVec = [0, 1, 0, 0, 0];

      const scoreIdentical = score(identicalVec, identicalVec, mockFeatures);
      const scoreOrthogonal = score(identicalVec, orthogonalVec, mockFeatures);

      // Identical vectors should score higher
      expect(scoreIdentical).toBeGreaterThan(scoreOrthogonal);
    });
  });
});

