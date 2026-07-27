/**
 * live-npi-registry-identity.test.ts — truth pin for the homepage NPI card header.
 *
 * The card's identity header renders under registry framing ("located in
 * NPPES"). In production this framing wrapped a registered account's
 * self-entered display name: NPI 1003000126 rendered "Sarah Chen" (a seeded
 * test profile) as if it were the NPPES record of ARDALAN ENKESHAFI, the NPI's
 * real registrant. `registryIdentity` is the gate that prevents this: identity
 * renders only when the payload is registry-derived — labeled `identitySource:
 * 'NPPES_API'` by the current backend, or, for the legacy payload shape with no
 * label (deploy skew), only when the NPI is NOT already registered, because the
 * legacy backend echoed the account's own profile fields for registered NPIs.
 *
 * Do not weaken these to make a payload change pass — the divergence case is
 * the truth contract itself (no registry framing around self-attested values).
 */
import { describe, expect, it } from 'vitest';

import { registryIdentity } from '@/components/home/LiveNpiResult';

describe('registryIdentity — provenance gate on the registry-framed header', () => {
  it('never presents a registered account name from an unlabeled (legacy) payload as the registry identity', () => {
    // Exactly the payload prod served for the Sarah Chen misattribution.
    const result = registryIdentity({
      firstName: 'Sarah',
      lastName: 'Chen',
      specialty: 'Internal Medicine',
      state: 'CA',
      alreadyRegistered: true,
    });

    expect(result.fromRegistry).toBe(false);
    expect(result.name).toBeNull();
    expect(result.detail).toBeNull();
  });

  it('renders identity labeled NPPES_API — including for registered NPIs, where it is the registry record, not the account name', () => {
    const result = registryIdentity({
      firstName: 'ARDALAN',
      lastName: 'ENKESHAFI',
      specialty: 'Hospitalist',
      state: 'MD',
      alreadyRegistered: true,
      identitySource: 'NPPES_API',
    });

    expect(result.fromRegistry).toBe(true);
    expect(result.name).toBe('Ardalan Enkeshafi');
    expect(result.detail).toBe('Hospitalist · MD');
  });

  it('renders nothing when the backend says the registry was unavailable', () => {
    const result = registryIdentity({
      alreadyRegistered: true,
      identitySource: 'UNAVAILABLE',
    });

    expect(result.fromRegistry).toBe(false);
    expect(result.name).toBeNull();
  });

  it('keeps legacy unregistered payloads rendering (their fields were registry-derived)', () => {
    // Deploy-skew compatibility: an old backend without identitySource only
    // ever put NPPES values here when the NPI had no registered profile.
    const result = registryIdentity({
      firstName: 'TIMOTHY',
      lastName: 'ROGERS',
      specialty: 'Family Medicine',
      state: 'CA',
    });

    expect(result.fromRegistry).toBe(true);
    expect(result.name).toBe('Timothy Rogers');
    expect(result.detail).toBe('Family Medicine · CA');
  });

  it('handles a registry hit with no personal name (Type 2 org) without inventing one', () => {
    const result = registryIdentity({ identitySource: 'NPPES_API', state: 'TX' });

    expect(result.fromRegistry).toBe(true);
    expect(result.name).toBeNull();
    expect(result.detail).toBe('TX');
  });

  it('resolves nothing from a null bootstrap', () => {
    expect(registryIdentity(null)).toEqual({ name: null, detail: null, fromRegistry: false });
  });
});
