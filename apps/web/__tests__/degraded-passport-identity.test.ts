import { describe, expect, it } from 'vitest';

import { buildDegradedPassportStub } from '@/lib/trust/buildDegradedPassportStub';

/**
 * P0.1 — the degraded passport stub asserted identity facts it had not read.
 *
 * `/api/passport/npi/:npi` is public. The stub hardcoded
 * `entityType: 'individual'`, so NPPES organizations (NPI-2) were published as
 * people, and it read `taxonomies[0]` as *the* specialty even when NPPES marks
 * a different row primary.
 *
 * The fixtures use synthetic identities with the shape
 * `fetchNppesIdentityProbe` hands the stub: `results[0]` verbatim.
 */

/** NPI-1. NPPES lists three non-primary Internal Medicine rows before the primary. */
const INDIVIDUAL_WITH_NON_PRIMARY_FIRST = {
  enumeration_type: 'NPI-1',
  basic: { first_name: 'Synthetic', last_name: 'Clinician', status: 'A' },
  taxonomies: [
    { code: '207R00000X', desc: 'Internal Medicine', primary: false },
    { code: '207R00000X', desc: 'Internal Medicine', primary: false },
    { code: '207R00000X', desc: 'Internal Medicine', primary: false },
    { code: '208M00000X', desc: 'Hospitalist', primary: true },
  ],
};

/** NPI-2 — an organization the stub used to publish as an individual. */
const ORGANIZATION = {
  enumeration_type: 'NPI-2',
  basic: { organization_name: 'Synthetic Organization', status: 'A' },
  taxonomies: [{ code: '111N00000X', desc: 'Chiropractor', primary: true }],
};

describe('buildDegradedPassportStub — identity is read, not assumed', () => {
  it('reports an NPPES organization as an organization', () => {
    const passport = buildDegradedPassportStub('9000000009', ORGANIZATION);

    expect(passport.identity.entityType).toBe('organization');
    expect(passport.identity.entityType).not.toBe('individual');
  });

  it('uses the organization name NPPES supplies instead of an NPI placeholder', () => {
    const passport = buildDegradedPassportStub('9000000009', ORGANIZATION);

    expect(passport.identity.displayName).toBe('Synthetic Organization');
  });

  it('reports an NPPES individual as an individual', () => {
    const passport = buildDegradedPassportStub('9000000001', INDIVIDUAL_WITH_NON_PRIMARY_FIRST);

    expect(passport.identity.entityType).toBe('individual');
    expect(passport.identity.displayName).toBe('Synthetic Clinician');
  });

  it('publishes the primary taxonomy, not whichever row NPPES returned first', () => {
    const passport = buildDegradedPassportStub('9000000001', INDIVIDUAL_WITH_NON_PRIMARY_FIRST);

    expect(passport.identity.specialty).toBe('Hospitalist');
    expect(passport.identity.specialty).not.toBe('Internal Medicine');
  });

  it('withholds the specialty when NPPES marks no row primary', () => {
    const noPrimary = {
      enumeration_type: 'NPI-1',
      basic: { first_name: 'JANE', last_name: 'DOE', status: 'A' },
      taxonomies: [
        { code: '207R00000X', desc: 'Internal Medicine', primary: false },
        { code: '208M00000X', desc: 'Hospitalist', primary: false },
      ],
    };

    const passport = buildDegradedPassportStub('9000000008', noPrimary);

    // Guessing a row is the defect being fixed, so absent beats arbitrary.
    expect(passport.identity.specialty).toBeUndefined();
  });

  it('claims no entity type when NPPES returned nothing to read', () => {
    const passport = buildDegradedPassportStub('9000000001', null);

    expect(passport.identity.entityType).toBe('unknown');
    expect(passport.identity.specialty).toBeUndefined();
    expect(passport.identity.displayName).toBe('NPI 9000000001');
  });
});
