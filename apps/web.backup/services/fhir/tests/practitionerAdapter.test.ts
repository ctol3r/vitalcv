import { describe, expect, it } from 'vitest';
import { clinicianToPractitioner } from '../../fhir/adapter/practitionerAdapter';
import { validateResource } from '../../fhir/validator';

describe('clinicianToPractitioner', () => {
  it('produces a valid Practitioner resource', () => {
    const resource = clinicianToPractitioner({
      id: 'clinician-1',
      npi: '1234567890',
      name: {
        first: 'Avery',
        last: 'Stone',
      },
      contact: {
        email: 'avery.stone@example.org',
        phone: '555-123-4567',
      },
      addresses: [{
        line1: '100 Market St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
      }],
      specialties: [{
        code: '207R00000X',
        display: 'Internal Medicine',
      }],
    });

    const validation = validateResource(resource, 'Practitioner');
    expect(validation.valid).toBe(true);
    expect(resource.identifier[0].system).toBe('urn:oid:2.16.840.1.113883.4.6');
  });

  it('throws when required data missing', () => {
    expect(() => clinicianToPractitioner({
      id: 'clinician-2',
      name: { first: '', last: '' },
      contact: { email: 'missing.address@example.org' },
      specialties: [{ code: '207Q00000X' }],
    } as any)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { clinicianToPractitioner } from '../../fhir/adapter/practitionerAdapter';
import { validateResource } from '../../fhir/validator';

describe('clinicianToPractitioner', () => {
  it('maps clinician profile into valid Practitioner resource', () => {
    const resource = clinicianToPractitioner({
      id: 'clinician-123',
      npi: '1234567890',
      name: {
        first: 'Avery',
        last: 'Stone',
      },
      contact: {
        email: 'avery.stone@example.org',
        phone: '555-123-4567',
      },
      addresses: [{
        line1: '100 Market St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
      }],
      specialties: [{
        code: '207R00000X',
        display: 'Internal Medicine',
      }],
    });

    expect(resource.identifier[0].system).toBe('urn:oid:2.16.840.1.113883.4.6');
    expect(resource.telecom?.[0].system).toBe('email');
    expect(resource.address?.[0].state).toBe('CA');
    expect(resource.qualification?.length).toBeGreaterThan(0);

    const validation = validateResource(resource, 'Practitioner');
    expect(validation.valid).toBe(true);
  });

  it('throws when required fields are missing', () => {
    expect(() => clinicianToPractitioner({
      id: 'clinician-124',
      name: {
        first: '',
        last: '',
      },
      contact: {
        email: 'no.address@example.org',
      },
      specialties: [{
        code: '207Q00000X',
      }],
    } as any)).toThrow();
  });
});


