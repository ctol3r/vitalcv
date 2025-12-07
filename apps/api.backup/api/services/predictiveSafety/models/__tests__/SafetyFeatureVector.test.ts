/**
 * Tests for SafetyFeatureVector model
 */

import { describe, it, expect } from '@jest/globals';
import {
  createSafetyFeatureVector,
  validateFeatureVector,
  featureVectorToArray,
  FEATURE_NAMES,
  SafetyFeaturesSchema,
} from '../SafetyFeatureVector.js';

describe('SafetyFeatureVector', () => {
  const validFeatures = {
    oppe_trend: 0.5,
    fppe_outcomes: 0.8,
    complication_rate: 0.2,
    drift_events: 0.1,
    license_freshness: 0.9,
    board_freshness: 0.85,
    dea_expiry: 0.95,
    pecos_status: 1.0,
    payer_denials: 0.05,
    ehr_mismatches: 0.0,
  };

  it('should create a valid feature vector', () => {
    const vector = createSafetyFeatureVector({
      clinicianId: 'clinician-123',
      timestamp: new Date('2024-01-15'),
      features: validFeatures,
    });

    expect(vector.clinicianId).toBe('clinician-123');
    expect(vector.timestamp).toBeInstanceOf(Date);
    expect(vector.features).toEqual(validFeatures);
  });

  it('should validate feature vector', () => {
    const vector = {
      clinicianId: 'clinician-123',
      timestamp: new Date('2024-01-15'),
      features: validFeatures,
    };

    const validated = validateFeatureVector(vector);
    expect(validated).toBeDefined();
    expect(validated.clinicianId).toBe('clinician-123');
  });

  it('should reject invalid clinicianId', () => {
    expect(() => {
      createSafetyFeatureVector({
        clinicianId: '',
        timestamp: new Date(),
        features: validFeatures,
      });
    }).toThrow();
  });

  it('should reject features outside valid range', () => {
    expect(() => {
      createSafetyFeatureVector({
        clinicianId: 'clinician-123',
        timestamp: new Date(),
        features: {
          ...validFeatures,
          oppe_trend: 2.0, // Invalid: > 1
        },
      });
    }).toThrow();
  });

  it('should convert features to array', () => {
    const array = featureVectorToArray(validFeatures);
    expect(array).toHaveLength(10);
    expect(array[0]).toBe(0.5); // oppe_trend
    expect(array[1]).toBe(0.8); // fppe_outcomes
    expect(array[9]).toBe(0.0); // ehr_mismatches
  });

  it('should have correct feature names', () => {
    expect(FEATURE_NAMES).toHaveLength(10);
    expect(FEATURE_NAMES[0]).toBe('oppe_trend');
    expect(FEATURE_NAMES[9]).toBe('ehr_mismatches');
  });

  it('should accept coerced date strings', () => {
    const vector = createSafetyFeatureVector({
      clinicianId: 'clinician-123',
      timestamp: '2024-01-15T00:00:00Z' as any,
      features: validFeatures,
    });

    expect(vector.timestamp).toBeInstanceOf(Date);
  });

  it('should validate all feature ranges', () => {
    const testCases = [
      { oppe_trend: -1.0 }, // Valid: minimum
      { oppe_trend: 1.0 }, // Valid: maximum
      { fppe_outcomes: 0.0 }, // Valid: minimum
      { fppe_outcomes: 1.0 }, // Valid: maximum
      { complication_rate: 0.0 },
      { complication_rate: 1.0 },
    ];

    for (const testCase of testCases) {
      const features = { ...validFeatures, ...testCase };
      expect(() => {
        SafetyFeaturesSchema.parse(features);
      }).not.toThrow();
    }
  });

  it('should reject out-of-range features', () => {
    const invalidCases = [
      { oppe_trend: -1.1 }, // Below minimum
      { oppe_trend: 1.1 }, // Above maximum
      { fppe_outcomes: -0.1 },
      { fppe_outcomes: 1.1 },
    ];

    for (const testCase of invalidCases) {
      const features = { ...validFeatures, ...testCase };
      expect(() => {
        SafetyFeaturesSchema.parse(features);
      }).toThrow();
    }
  });
});

