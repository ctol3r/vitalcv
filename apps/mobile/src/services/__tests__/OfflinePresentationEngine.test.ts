import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeJwt, decodeProtectedHeader } from 'jose';

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
import { OfflinePresentationEngine } from '../OfflinePresentationEngine';

const credential: StoredCredential = {
  id: 'cred-presentation',
  npi: '1234567890',
  type: 'MedicalLicense',
  issuer: 'VitalCV State Board',
  status: 'VALID',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-12-01T00:00:00.000Z',
  vcJwt: 'jwt-presentation',
  claims: {
    npi: '1234567890',
    state: 'CA',
    licenseNumber: 'CA-001',
  },
  issuerDid: 'did:key:zIssuer',
  proofAlgorithm: 'ES256',
};

describe('OfflinePresentationEngine', () => {
  beforeEach(() => {
    secureStoreState.clear();
    vi.unstubAllGlobals();
  });

  it('creates an ES256 VP JWT with the expected structure', async () => {
    const store = new LocalCredentialStore();
    await store.storeCredential(credential);
    const engine = new OfflinePresentationEngine(store);

    const presentation = await engine.createPresentation({
      credentialIds: [credential.id],
      verifierDid: 'did:key:zVerifier',
      nonce: 'nonce-123',
    });
    const header = decodeProtectedHeader(presentation.vpJwt);
    const payload = decodeJwt(presentation.vpJwt);

    expect(header.alg).toBe('ES256');
    expect(payload.iss).toBe(presentation.holderDid);
    expect(payload.nonce).toBe('nonce-123');
    expect(payload.vp).toMatchObject({
      holder: presentation.holderDid,
      verifiableCredential: [
        expect.objectContaining({
          id: credential.id,
          type: ['VerifiableCredential', credential.type],
        }),
      ],
    });
  });

  it('creates selective disclosure payloads that hash non-disclosed claims', async () => {
    const store = new LocalCredentialStore();
    await store.storeCredential(credential);
    const engine = new OfflinePresentationEngine(store);

    const disclosed = await engine.createSelectiveDisclosure(credential.id, ['state']);

    expect(disclosed.claims.state).toBe('CA');
    expect(disclosed.claims.npi).toMatch(/^sha256:/);
    expect(disclosed.claims.licenseNumber).toMatch(/^sha256:/);
  });

  it('creates presentations without requiring network access', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network disabled');
      }),
    );

    const store = new LocalCredentialStore();
    await store.storeCredential(credential);
    const engine = new OfflinePresentationEngine(store);

    await expect(
      engine.createPresentation({
        credentialIds: [credential.id],
      }),
    ).resolves.toMatchObject({
      credentialIds: [credential.id],
    });
  });
});
