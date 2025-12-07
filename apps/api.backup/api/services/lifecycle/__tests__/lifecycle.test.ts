/**
 * Tests for lifecycle service components
 */

import { describe, it, expect } from '@jest/globals';
import { createLifecycleState, validateLifecycleState } from '../models/LifecycleState.js';
import { temporalFeatureExtractor } from '../extractors/temporalFeatures.js';
import { lifecycleEventSeriesBuilder } from '../extractors/eventSeries.js';
import { getProjectionDate, getAllProjectionDates, PROJECTION_WINDOWS } from '../constants.js';

describe('LifecycleState', () => {
  it('should create a valid lifecycle state', () => {
    const state = createLifecycleState({
      clinicianId: 'clinician-123',
      orgId: 'org-456',
      department: 'Emergency',
      timestamp: new Date(),
      privileges: {
        privilegeCodes: ['PRIV-001', 'PRIV-002'],
        status: 'ACTIVE',
      },
      credentialFreshness: {
        licenseExpiryDays: 365,
        boardExpiryDays: 730,
      },
      cci: {
        cciScore: 85,
        computedAt: new Date(),
      },
    });

    expect(state.clinicianId).toBe('clinician-123');
    expect(state.orgId).toBe('org-456');
    expect(state.privileges?.privilegeCodes).toHaveLength(2);
    expect(state.cci?.cciScore).toBe(85);
  });

  it('should validate lifecycle state', () => {
    const validState = {
      clinicianId: 'clinician-123',
      timestamp: new Date(),
    };

    expect(() => validateLifecycleState(validState)).not.toThrow();
  });

  it('should reject invalid lifecycle state', () => {
    const invalidState = {
      // Missing required clinicianId
      timestamp: new Date(),
    };

    expect(() => validateLifecycleState(invalidState)).toThrow();
  });
});

describe('LifecycleProjectionConstants', () => {
  it('should define all projection windows', () => {
    expect(PROJECTION_WINDOWS['3mo']).toBe(3);
    expect(PROJECTION_WINDOWS['6mo']).toBe(6);
    expect(PROJECTION_WINDOWS['12mo']).toBe(12);
    expect(PROJECTION_WINDOWS['24mo']).toBe(24);
    expect(PROJECTION_WINDOWS['36mo']).toBe(36);
  });

  it('should calculate projection dates correctly', () => {
    const baseDate = new Date('2024-01-01');
    const projected3mo = getProjectionDate(baseDate, '3mo');
    const projected12mo = getProjectionDate(baseDate, '12mo');

    expect(projected3mo.getMonth()).toBe(3); // April (0-indexed, so 3 = April)
    expect(projected12mo.getFullYear()).toBe(2025);
  });

  it('should get all projection dates', () => {
    const baseDate = new Date('2024-01-01');
    const allDates = getAllProjectionDates(baseDate);

    expect(allDates['3mo']).toBeInstanceOf(Date);
    expect(allDates['6mo']).toBeInstanceOf(Date);
    expect(allDates['12mo']).toBeInstanceOf(Date);
    expect(allDates['24mo']).toBeInstanceOf(Date);
    expect(allDates['36mo']).toBeInstanceOf(Date);
  });
});

describe('TemporalFeatureExtractor', () => {
  it('should extract credential half-life', () => {
    const states = [
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-01-01'),
        credentialFreshness: {
          licenseExpiryDays: 365,
          boardExpiryDays: 730,
          deaExpiryDays: 180,
        },
      }),
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-02-01'),
        credentialFreshness: {
          licenseExpiryDays: 335,
          boardExpiryDays: 700,
          deaExpiryDays: 150,
        },
      }),
    ];

    const halfLife = temporalFeatureExtractor.extractCredentialHalfLife(states);

    expect(halfLife.licenseHalfLife).toBeGreaterThan(0);
    expect(halfLife.boardHalfLife).toBeGreaterThan(0);
    expect(halfLife.overallHalfLife).toBeGreaterThan(0);
  });

  it('should extract seasonality pattern', () => {
    const states = Array.from({ length: 12 }, (_, i) =>
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date(2024, i, 1),
        cci: {
          cciScore: 70 + i * 2, // Varying scores
          computedAt: new Date(2024, i, 1),
        },
      })
    );

    const seasonality = temporalFeatureExtractor.extractSeasonality(states);

    expect(seasonality.monthlyPattern).toHaveLength(12);
    expect(seasonality.quarterlyPattern).toHaveLength(4);
    expect(seasonality.peakMonth).toBeGreaterThanOrEqual(0);
    expect(seasonality.peakMonth).toBeLessThan(12);
  });

  it('should extract renewal clustering', () => {
    const states = [
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-01-01'),
        credentialFreshness: {
          licenseExpiryDays: 30,
          boardExpiryDays: 60,
        },
      }),
    ];

    const clustering = temporalFeatureExtractor.extractRenewalClustering(states);

    expect(clustering.clusterCount).toBeGreaterThanOrEqual(0);
    expect(clustering.clusterDensity).toBeGreaterThanOrEqual(0);
    expect(clustering.clusterDensity).toBeLessThanOrEqual(1);
  });

  it('should extract risk aging curve', () => {
    const states = [
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-01-01'),
        risk: {
          riskScore: 0.3,
          riskLevel: 'LOW',
        },
      }),
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-06-01'),
        risk: {
          riskScore: 0.5,
          riskLevel: 'MED',
        },
      }),
    ];

    const riskCurve = temporalFeatureExtractor.extractRiskAgingCurve(states);

    expect(riskCurve.currentRisk).toBeGreaterThanOrEqual(0);
    expect(riskCurve.currentRisk).toBeLessThanOrEqual(1);
    expect(riskCurve.projectedRisk['3mo']).toBeGreaterThanOrEqual(0);
    expect(riskCurve.projectedRisk['3mo']).toBeLessThanOrEqual(1);
  });
});

describe('LifecycleEventSeriesBuilder', () => {
  it('should build event series from states', () => {
    const states = [
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-01-01'),
        drift: {
          eventCount: 1,
          recentEvents: [
            {
              eventId: 'drift-1',
              type: 'license_drift',
              detectedAt: new Date('2024-01-01'),
            },
          ],
        },
        oppeFppe: {
          oppe: {
            status: 'ACTIVE',
            lastReviewDate: new Date('2024-01-01'),
          },
        },
      }),
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-02-01'),
        privileges: {
          privilegeCodes: ['PRIV-001'],
          status: 'ACTIVE',
        },
      }),
    ];

    const series = lifecycleEventSeriesBuilder.buildFromStates(states);

    expect(series.clinicianId).toBe('clinician-123');
    expect(series.events.length).toBeGreaterThan(0);
    expect(series.startDate).toBeInstanceOf(Date);
    expect(series.endDate).toBeInstanceOf(Date);
  });

  it('should filter events by type', () => {
    const states = [
      createLifecycleState({
        clinicianId: 'clinician-123',
        timestamp: new Date('2024-01-01'),
        drift: {
          eventCount: 1,
          recentEvents: [
            {
              eventId: 'drift-1',
              type: 'license_drift',
              detectedAt: new Date('2024-01-01'),
            },
          ],
        },
      }),
    ];

    const series = lifecycleEventSeriesBuilder.buildFromStates(states);
    const driftEvents = lifecycleEventSeriesBuilder.filterByType(series, 'drift');

    expect(driftEvents.length).toBeGreaterThan(0);
    expect(driftEvents.every((e) => e.type === 'drift')).toBe(true);
  });
});

