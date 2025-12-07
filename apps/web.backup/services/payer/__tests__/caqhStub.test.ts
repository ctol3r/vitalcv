import { describe, expect, it } from '@jest/globals';
import { fetchDemoCaqhProfile, getDemoCaqhProfile } from '../stub/caqhStub.js';

describe('CAQH stub', () => {
  it('returns specialties, education, and practice locations', async () => {
    const snapshot = getDemoCaqhProfile();

    expect(snapshot.fields.specialties.length).toBeGreaterThan(0);
    expect(snapshot.fields.education.length).toBeGreaterThan(0);
    expect(snapshot.fields.practiceLocations.length).toBeGreaterThan(0);
    expect(snapshot.fields.malpractice).not.toBeNull();
  });

  it('simulates async fetch for payer enrollment prefill', async () => {
    const start = Date.now();
    const snapshot = await fetchDemoCaqhProfile();
    const duration = Date.now() - start;

    expect(snapshot.caqhId).toMatch(/^CAQH-DEMO/);
    expect(duration).toBeGreaterThanOrEqual(100);
  });
});

import { describe, expect, it } from '@jest/globals';
import { getDemoCaqhProfile } from '../../payer/stub/caqhStub.js';

describe('CAQH stub', () => {
  it('returns deterministic demo data with specialties and practice locations', () => {
    const profile = getDemoCaqhProfile();

    expect(profile.clinicianId).toBeDefined();
    expect(profile.caqhId).toMatch(/^CAQH/);
    expect(profile.fields.specialties.length).toBeGreaterThan(0);
    expect(profile.fields.practiceLocations.length).toBeGreaterThan(0);
    expect(profile.fields.practiceLocations[0].facilityName).toBeTruthy();
  });
});
import { describe, expect, it } from '@jest/globals';
import { getDemoCaqhProfile } from '../stub/caqhStub.js';

describe('CAQH stub', () => {
  it('returns demo profile with key sections populated', () => {
    const stub = getDemoCaqhProfile();

    expect(stub.fields.specialties.length).toBeGreaterThan(0);
    expect(stub.fields.practiceLocations.length).toBeGreaterThan(0);
    expect(stub.fields.education.length).toBeGreaterThan(0);
    expect(stub.fields.malpractice).toBeTruthy();

    const hasDeaLicense = stub.fields.licenses.some((lic) =>
      lic.licenseType.toUpperCase().includes('DEA')
    );
    expect(hasDeaLicense).toBe(true);
  });

  it('allows overriding sample data', () => {
    const stub = getDemoCaqhProfile({
      clinicianId: 'clinician-override',
      fields: {
        specialties: [
          {
            taxonomyCode: '1234',
            specialty: 'Test Specialty',
            boardCertified: false,
          },
        ],
      },
    });

    expect(stub.clinicianId).toBe('clinician-override');
    expect(stub.fields.specialties[0].specialty).toBe('Test Specialty');
  });
});

