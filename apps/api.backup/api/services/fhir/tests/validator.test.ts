import { describe, expect, it } from 'vitest';
import { validateResource } from '../../fhir/validator';

describe('validateResource', () => {
  it('accepts a valid Practitioner', () => {
    const result = validateResource({
      resourceType: 'Practitioner',
      id: 'test',
      identifier: [{
        system: 'urn:oid:2.16.840.1.113883.4.6',
        value: '1234567890',
      }],
      name: [{
        family: 'Example',
        given: ['Test'],
      }],
      telecom: [{
        system: 'email',
        value: 'test@example.org',
      }],
      address: [{
        line: ['1 Main'],
        city: 'SF',
        state: 'CA',
      }],
      qualification: [{
        code: {
          coding: [{
            system: 'http://nucc.org/provider-taxonomy',
            code: '207Q00000X',
          }],
        },
      }],
    }, 'Practitioner');

    expect(result.valid).toBe(true);
  });

  it('rejects invalid resource', () => {
    const result = validateResource({
      resourceType: 'Practitioner',
      id: 'broken',
    }, 'Practitioner');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { validateResource } from '../../fhir/validator';

describe('validateResource', () => {
  it('validates Practitioner resource', () => {
    const result = validateResource({
      resourceType: 'Practitioner',
      id: 'test',
      identifier: [{
        system: 'urn:oid:2.16.840.1.113883.4.6',
        value: '1234567890',
      }],
      name: [{
        family: 'Example',
        given: ['Test'],
      }],
      telecom: [{
        system: 'email',
        value: 'test@example.org',
      }],
      address: [{
        line: ['1 Main'],
        city: 'SF',
        state: 'CA',
      }],
      qualification: [{
        code: {
          coding: [{
            system: 'http://nucc.org/provider-taxonomy',
            code: '207Q00000X',
          }],
        },
      }],
    }, 'Practitioner');

    expect(result.valid).toBe(true);
  });

  it('returns errors for invalid resource', () => {
    const result = validateResource({
      resourceType: 'Practitioner',
      id: 'broken',
    }, 'Practitioner');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});


