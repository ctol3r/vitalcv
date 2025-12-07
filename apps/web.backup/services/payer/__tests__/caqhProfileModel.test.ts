import { describe, expect, it } from '@jest/globals';
import { MOCK_CAQH_PROFILE } from '../caqhClient.js';
import {
  buildCaqhFieldsFromProfile,
  parseCaqhProfileFields,
  type CaqhProfileFields,
} from '../models/CAQHProfile.js';

describe('CAQHProfile model', () => {
  it('parses stored payload and hydrates defaults', () => {
    const parsed = parseCaqhProfileFields({
      caqhId: 'CAQH123',
      clinicianId: 'clinician-1',
      status: 'Active',
    });

    expect(parsed.specialties).toEqual([]);
    expect(parsed.education).toEqual([]);
    expect(parsed.practiceLocations).toEqual([]);
    expect(parsed.malpractice).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(() =>
      parseCaqhProfileFields({
        caqhId: '',
        clinicianId: '',
        status: '',
      })
    ).toThrow();
  });

  it('builds snapshot fields from CAQH profile', () => {
    const fields = buildCaqhFieldsFromProfile(MOCK_CAQH_PROFILE, 'clinician-1');

    expect(fields.caqhId).toBe(MOCK_CAQH_PROFILE.caqhId);
    expect(fields.clinicianId).toBe('clinician-1');
    expect(fields.licenses.length).toBeGreaterThan(0);
    expect(fields.boardCertifications.length).toBe(
      MOCK_CAQH_PROFILE.profile.boardCertifications.length
    );
    expect(fields.specialties.length).toBeGreaterThan(0);
  });

  it('serialises and parses symmetrically', () => {
    const built = buildCaqhFieldsFromProfile(MOCK_CAQH_PROFILE, 'clinician-1');
    const roundTripped = parseCaqhProfileFields(JSON.parse(JSON.stringify(built)) as CaqhProfileFields);

    expect(roundTripped).toMatchObject({
      caqhId: built.caqhId,
      clinicianId: built.clinicianId,
      status: built.status,
    });
    expect(roundTripped.licenses).toHaveLength(built.licenses.length);
    expect(roundTripped.practiceLocations).toHaveLength(built.practiceLocations.length);
  });
});

import { describe, expect, it } from '@jest/globals';
import { MOCK_CAQH_PROFILE } from '../caqhClient.js';
import {
  mapCaqhProfileToFields,
  parseCaqhProfileFields,
} from '../models/CAQHProfile.js';

describe('CAQHProfile model', () => {
  it('normalizes CAQH profile into persisted fields', () => {
    const fields = mapCaqhProfileToFields(MOCK_CAQH_PROFILE);

    expect(fields.caqhId).toBe(MOCK_CAQH_PROFILE.caqhId);
    expect(fields.specialties.length).toBeGreaterThan(0);
    expect(fields.education.length).toBeGreaterThan(0);
    expect(fields.practiceLocations.length).toBeGreaterThan(0);
    expect(fields.licenses.length).toBeGreaterThan(0);
    expect(fields.boardCertifications.length).toBeGreaterThan(0);
    expect(fields.malpractice).toBeTruthy();
  });

  it('validates schema for persisted fields', () => {
    expect(() =>
      parseCaqhProfileFields({
        caqhId: '',
        status: 'Active',
        attestationDate: '2024-01-01',
        expirationDate: '2025-01-01',
        lastUpdatedAt: '2024-12-01',
        specialties: [],
        education: [],
        practiceLocations: [],
        licenses: [],
        boardCertifications: [],
      })
    ).toThrow();
  });
});

