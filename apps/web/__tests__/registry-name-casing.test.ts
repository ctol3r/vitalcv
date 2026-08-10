/**
 * Registry name casing — one transform, two surfaces.
 *
 * NPPES stores names upper case. Two surfaces render that same field from
 * that same response: the evidence capsule's identity header
 * (`registryIdentity`) and the recognition reveal's `displayName`
 * (`buildCareerProfile`). They disagreed in production — the capsule said
 * "Jacob Aaron", the reveal shouted "JACOB AARON" — because each did its own
 * thing with the value.
 *
 * The binding property here is AGREEMENT, not a particular casing rule: both
 * surfaces must render the identical string for the identical input. That is
 * what stops the two drifting apart again.
 */

import { describe, expect, it } from 'vitest';

import {
  registryDisplayName,
  registryIdentity,
  type Bootstrap,
} from '../components/home/evidence/evidenceCapsuleModel';
import { buildCareerProfile } from '../lib/career-loop/profile';

const NPI = 'test-npi';

function boot(firstName: string, lastName: string): Bootstrap {
  return {
    firstName,
    lastName,
    specialty: 'Internal Medicine',
    state: 'CA',
    npiType: 'TYPE_1',
    identitySource: 'NPPES_API',
  };
}

describe('registryDisplayName', () => {
  it('cases an NPPES upper-case name the way a person writes it', () => {
    expect(registryDisplayName('JACOB AARON')).toBe('Jacob Aaron');
  });

  it('leaves an already-cased name alone', () => {
    expect(registryDisplayName('Jacob Aaron')).toBe('Jacob Aaron');
  });

  it('returns null for absent or blank input rather than an empty name', () => {
    expect(registryDisplayName(null)).toBeNull();
    expect(registryDisplayName(undefined)).toBeNull();
    expect(registryDisplayName('   ')).toBeNull();
  });

  it('changes only casing — never the characters of a real person’s name', () => {
    for (const raw of ['JACOB AARON', "O'BRIEN MARY", 'VAN DER BERG ANNA', 'MCDONALD IAN']) {
      expect(registryDisplayName(raw)?.toUpperCase()).toBe(raw);
    }
  });

  it('does not invent internal capitals (documented limit, not a bug)', () => {
    // Reconstructing "McDonald" would be guessing about a real person. The
    // correction path is where a clinician fixes their own name.
    expect(registryDisplayName('MCDONALD IAN')).toBe('Mcdonald Ian');
  });
});

describe('the two identity surfaces agree', () => {
  const cases: Array<[string, string]> = [
    ['JACOB', 'AARON'],
    ['Maria', 'GARCIA'],
    ['anne', 'okafor'],
  ];

  it.each(cases)('renders %s %s identically in capsule and profile', (first, last) => {
    const b = boot(first, last);
    const capsuleName = registryIdentity(b).name;
    const profileName = buildCareerProfile(NPI, b, null)?.displayName;
    expect(profileName).toBe(capsuleName);
  });

  it('keeps the monogram derived from the cased name', () => {
    const profile = buildCareerProfile(NPI, boot('JACOB', 'AARON'), null);
    expect(profile?.displayName).toBe('Jacob Aaron');
    expect(profile?.monogram).toBe('JA');
  });
});
