import { describe, expect, it } from 'vitest';
import {
  isSyntheticProviderLabel,
  resolvePublicProviderDisplayName,
  resolvePublicProviderSpecialty,
  resolveTrustStateIdentityDisplayName,
  resolveTrustStateSpecialty,
} from '../lib/trust/public-provider-identity';

describe('public provider identity helpers', () => {
  it('treats backend fallback names as synthetic labels', () => {
    expect(isSyntheticProviderLabel('Provider not found in NPPES')).toBe(true);
    expect(isSyntheticProviderLabel('Resolution unavailable')).toBe(true);
    expect(isSyntheticProviderLabel('Unknown Provider')).toBe(true);
    expect(isSyntheticProviderLabel('Unknown Organization')).toBe(true);
  });

  it('falls back to the NPI instead of rendering a synthetic name as identity', () => {
    expect(
      resolvePublicProviderDisplayName({
        displayName: 'Provider not found in NPPES',
        npi: '1234567890',
      }),
    ).toBe('NPI 1234567890');
  });

  it('suppresses specialty when the attached display name is synthetic', () => {
    expect(
      resolvePublicProviderSpecialty({
        displayName: 'Resolution unavailable',
        specialty: 'Cardiology',
      }),
    ).toBeNull();
  });

  it('still returns real names unchanged', () => {
    expect(
      resolvePublicProviderDisplayName({
        displayName: 'Meredith Grey',
        npi: '1234567890',
      }),
    ).toBe('Meredith Grey');
  });

  it('resolves trust-state identity details from IdentityClaim facts', () => {
    expect(resolveTrustStateIdentityDisplayName([
      { factType: 'IdentityClaim', details: 'Ardalan Enkeshafi' },
    ])).toBe('Ardalan Enkeshafi');
  });

  it('resolves trust-state specialty details from fact arrays', () => {
    expect(resolveTrustStateSpecialty([
      { factType: 'SPECIALTY', details: 'Hospitalist' },
    ])).toBe('Hospitalist');
  });
});
