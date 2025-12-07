import { describe, expect, it } from '@jest/globals';
import { MOCK_CAQH_PROFILE } from '../../payer/caqhClient.js';
import {
  mapCaqhProfileToFields,
  parseCaqhProfileFields,
  serializeCaqhProfileFields,
  type PracticeLocation,
  type SpecialtyField,
} from '../../payer/models/CAQHProfile.js';

describe('CAQHProfile model helpers', () => {
  it('parses persisted fields payloads and fills defaults', () => {
    const parsed = parseCaqhProfileFields({
      caqhId: 'CAQH123',
      status: 'Active',
      specialties: [],
      education: [],
      licenses: [],
      boardCertifications: [],
      malpractice: null,
      practiceLocations: [],
    });

    expect(parsed.caqhId).toBe('CAQH123');
    expect(parsed.specialties).toEqual([]);
    expect(parsed.malpractice).toBeNull();
  });

  it('throws when payload is missing required keys', () => {
    expect(() =>
      parseCaqhProfileFields({
        specialties: [],
      })
    ).toThrow();
  });

  it('maps CAQH API payloads into persisted fields', () => {
    const practiceLocations: PracticeLocation[] = [
      {
        facilityName: 'Demo Clinic',
        address1: '123 Main',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95113',
        startDate: '2019-01-01',
        currentlyPracticing: true,
      },
    ];
    const specialties: SpecialtyField[] = [
      {
        specialty: 'Internal Medicine',
        taxonomyCode: '207R00000X',
        primary: true,
        status: 'Active',
      },
    ];

    const mapped = mapCaqhProfileToFields(MOCK_CAQH_PROFILE, {
      clinicianId: 'clinician-1',
      practiceLocations,
      specialties,
      syncedAt: new Date('2025-01-01T00:00:00Z'),
    });

    expect(mapped.caqhId).toBe(MOCK_CAQH_PROFILE.caqhId);
    expect(mapped.clinicianId).toBe('clinician-1');
    expect(mapped.practiceLocations).toEqual(practiceLocations);
    expect(mapped.specialties[0].taxonomyCode).toBe('207R00000X');
    expect(mapped.malpractice?.carrier).toBe(
      MOCK_CAQH_PROFILE.profile.malpracticeInsurance.carrier
    );
  });

  it('serializes validated objects prior to persistence', () => {
    const mapped = mapCaqhProfileToFields(MOCK_CAQH_PROFILE);
    const serialized = serializeCaqhProfileFields(mapped);

    expect(serialized).toHaveProperty('caqhId', mapped.caqhId);
    expect(Array.isArray(serialized.specialties)).toBe(true);
  });
});

