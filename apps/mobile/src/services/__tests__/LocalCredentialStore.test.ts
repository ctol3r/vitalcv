import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreState = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: async (key: string) => {
    secureStoreState.delete(key);
  },
  getItemAsync: async (key: string) => secureStoreState.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStoreState.set(key, value);
  },
}));

import {
  LocalCredentialStore,
  type StoredCredential,
} from '../LocalCredentialStore';

const baseCredential: StoredCredential = {
  id: 'cred-roundtrip',
  npi: '1234567890',
  type: 'MedicalLicense',
  issuer: 'VitalCV State Board',
  status: 'ACTIVE',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-12-01T00:00:00.000Z',
  vcJwt: 'jwt-roundtrip',
  claims: {
    npi: '1234567890',
    state: 'CA',
    licenseNumber: 'CA-001',
  },
  issuerDid: 'did:key:zIssuer',
  proofAlgorithm: 'ES256',
};

describe('LocalCredentialStore', () => {
  beforeEach(() => {
    secureStoreState.clear();
  });

  it('stores a credential and lists it round-trip', async () => {
    const store = new LocalCredentialStore();

    await store.storeCredential(baseCredential);

    await expect(store.getCredential(baseCredential.id)).resolves.toEqual(baseCredential);
    await expect(store.listCredentials()).resolves.toEqual([baseCredential]);
  });

  it('returns only credentials expiring inside the threshold window', async () => {
    const store = new LocalCredentialStore();
    const nearExpiry = {
      ...baseCredential,
      id: 'cred-expiring-soon',
      expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    };
    const farExpiry = {
      ...baseCredential,
      id: 'cred-expiring-later',
      expiresAt: new Date(Date.now() + 120 * 86_400_000).toISOString(),
    };

    await store.storeCredential(nearExpiry);
    await store.storeCredential(farExpiry);

    await expect(store.getExpiringCredentials(30)).resolves.toEqual([nearExpiry]);
  });

  it('syncs API credentials as upserts', async () => {
    const store = new LocalCredentialStore();

    await store.syncFromApi([
      {
        credentialId: 'cred-sync',
        credentialType: 'MedicalLicense',
        issuer: 'VitalCV State Board',
        status: 'ACTIVE',
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-06-01T00:00:00.000Z',
        vcJwt: 'jwt-sync-v1',
        claims: {
          npi: '1234567890',
          state: 'CA',
        },
      },
    ]);

    await store.syncFromApi([
      {
        credentialId: 'cred-sync',
        credentialType: 'MedicalLicense',
        issuer: 'VitalCV State Board',
        status: 'ACTIVE',
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-07-01T00:00:00.000Z',
        vcJwt: 'jwt-sync-v2',
        claims: {
          npi: '1234567890',
          state: 'NY',
        },
      },
    ]);

    await expect(store.listCredentials()).resolves.toHaveLength(1);
    await expect(store.getCredential('cred-sync')).resolves.toMatchObject({
      vcJwt: 'jwt-sync-v2',
      claims: {
        npi: '1234567890',
        state: 'NY',
      },
      expiresAt: '2026-07-01T00:00:00.000Z',
    });
  });
});
