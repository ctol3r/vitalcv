/**
 * B209A-STRAT-001, B209A-STRAT-003: Tests for OrgStrategicState and OrgOperationalProfile models
 */

import { describe, expect, it } from '@jest/globals';
import {
  createOrgOperationalProfile,
  getNormalizedPayerMix,
  getSpecialties,
  validateOrgOperationalProfile,
} from '../models/OrgOperationalProfile.js';
import {
  createOrgStrategicState,
  ORG_STRATEGIC_INDEX_NAMES,
  orgStrategicStateToArray as stateToArray,
  validateOrgStrategicState,
} from '../models/OrgStrategicState.js';

describe('OrgStrategicState', () => {
  it('creates a valid strategic state', () => {
    const state = createOrgStrategicState({
      orgId: 'org-123',
      workforceReadinessIndex: 0.85,
      credentialRiskIndex: 0.2,
      privilegeCapacityIndex: 0.7,
      safetyIndex: 0.9,
      enrollmentStabilityIndex: 0.75,
      demandForecastIndex: 0.65,
    });

    expect(state.orgId).toBe('org-123');
    expect(state.workforceReadinessIndex).toBe(0.85);
    expect(state.credentialRiskIndex).toBe(0.2);
    expect(state.safetyIndex).toBe(0.9);
    expect(state.timestamp).toBeInstanceOf(Date);
  });

  it('validates strategic state with competency distribution', () => {
    const state = createOrgStrategicState({
      orgId: 'org-456',
      competencyDistribution: {
        '207R00000X': 0.3,
        '207Q00000X': 0.4,
        '207P00000X': 0.3,
      },
      departmentStability: {
        Emergency: 0.8,
        Surgery: 0.9,
        ICU: 0.7,
      },
    });

    expect(state.competencyDistribution).toEqual({
      '207R00000X': 0.3,
      '207Q00000X': 0.4,
      '207P00000X': 0.3,
    });
    expect(state.departmentStability).toEqual({
      Emergency: 0.8,
      Surgery: 0.9,
      ICU: 0.7,
    });
  });

  it('converts strategic state to array', () => {
    const state = createOrgStrategicState({
      orgId: 'org-789',
      workforceReadinessIndex: 0.8,
      credentialRiskIndex: 0.3,
      privilegeCapacityIndex: 0.6,
      safetyIndex: 0.85,
      enrollmentStabilityIndex: 0.7,
      demandForecastIndex: 0.65,
    });

    const array = stateToArray(state);
    expect(array).toHaveLength(6);
    expect(array[0]).toBe(0.8);
    expect(array[1]).toBe(0.3);
    expect(array[2]).toBe(0.6);
    expect(array[3]).toBe(0.85);
    expect(array[4]).toBe(0.7);
    expect(array[5]).toBe(0.65);
  });

  it('handles missing indices gracefully', () => {
    const state = createOrgStrategicState({
      orgId: 'org-empty',
    });

    const array = stateToArray(state);
    expect(array).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('validates invalid input', () => {
    expect(() => {
      validateOrgStrategicState({
        orgId: '', // Invalid: empty string
      });
    }).toThrow();

    expect(() => {
      validateOrgStrategicState({
        orgId: 'org-123',
        workforceReadinessIndex: 1.5, // Invalid: > 1
      });
    }).toThrow();
  });
});

describe('OrgOperationalProfile', () => {
  it('creates a valid operational profile', () => {
    const profile = createOrgOperationalProfile({
      orgId: 'org-123',
      specialties: ['207R00000X', '207Q00000X'],
      ehrType: 'epic',
    });

    expect(profile.orgId).toBe('org-123');
    expect(profile.specialties).toEqual(['207R00000X', '207Q00000X']);
    expect(profile.ehrType).toBe('epic');
    expect(profile.createdAt).toBeInstanceOf(Date);
    expect(profile.updatedAt).toBeInstanceOf(Date);
  });

  it('validates operational profile with volumes and payer mix', () => {
    const profile = createOrgOperationalProfile({
      orgId: 'org-456',
      specialties: ['207R00000X'],
      volumes: {
        '207R00000X': 1000,
        Emergency: 500,
      },
      payerMix: {
        'payer-1': 0.4,
        'payer-2': 0.3,
        'payer-3': 0.3,
      },
      geographicCompacts: {
        IMLC: ['CA', 'NY'],
        PSYPACT: ['CA'],
      },
    });

    expect(profile.volumes).toEqual({
      '207R00000X': 1000,
      Emergency: 500,
    });
    expect(profile.payerMix).toEqual({
      'payer-1': 0.4,
      'payer-2': 0.3,
      'payer-3': 0.3,
    });
    expect(profile.geographicCompacts).toEqual({
      IMLC: ['CA', 'NY'],
      PSYPACT: ['CA'],
    });
  });

  it('gets specialties from profile', () => {
    const profile = createOrgOperationalProfile({
      orgId: 'org-789',
      specialties: ['207R00000X', '207Q00000X', '207P00000X'],
    });

    const specialties = getSpecialties(profile);
    expect(specialties).toEqual(['207R00000X', '207Q00000X', '207P00000X']);
  });

  it('normalizes payer mix correctly', () => {
    const profile = createOrgOperationalProfile({
      orgId: 'org-normalize',
      payerMix: {
        'payer-1': 400,
        'payer-2': 300,
        'payer-3': 300,
      },
    });

    const normalized = getNormalizedPayerMix(profile);
    expect(normalized['payer-1']).toBeCloseTo(0.4, 2);
    expect(normalized['payer-2']).toBeCloseTo(0.3, 2);
    expect(normalized['payer-3']).toBeCloseTo(0.3, 2);
  });

  it('handles empty payer mix', () => {
    const profile = createOrgOperationalProfile({
      orgId: 'org-empty',
    });

    const normalized = getNormalizedPayerMix(profile);
    expect(normalized).toEqual({});
  });

  it('validates invalid input', () => {
    expect(() => {
      validateOrgOperationalProfile({
        orgId: '', // Invalid: empty string
      });
    }).toThrow();

    expect(() => {
      validateOrgOperationalProfile({
        orgId: 'org-123',
        ehrType: 'invalid' as any, // Invalid: not in enum
      });
    }).toThrow();
  });
});

