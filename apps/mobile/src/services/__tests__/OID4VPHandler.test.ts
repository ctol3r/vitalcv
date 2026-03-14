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
import { OfflinePresentationEngine } from '../OfflinePresentationEngine';
import { OID4VPHandler } from '../OID4VPHandler';

const medicalLicense: StoredCredential = {
  id: 'cred-medical-license',
  npi: '1234567890',
  type: 'MedicalLicense',
  issuer: 'VitalCV State Board',
  status: 'VALID',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-12-01T00:00:00.000Z',
  vcJwt: 'jwt-medical-license',
  claims: {
    npi: '1234567890',
    licenseType: 'medical_license',
    state: 'CA',
  },
  issuerDid: 'did:key:zIssuerMedical',
  proofAlgorithm: 'ES256',
};

const boardCertification: StoredCredential = {
  ...medicalLicense,
  id: 'cred-board-cert',
  type: 'BoardCertification',
  vcJwt: 'jwt-board-cert',
  claims: {
    npi: '1234567890',
    licenseType: 'board_certification',
    specialty: 'cardiology',
  },
};

const presentationDefinition = {
  id: 'pd-1',
  name: 'Medical Credential Verification',
  input_descriptors: [
    {
      id: 'medical_license',
      constraints: {
        fields: [
          {
            path: ['$.type', '$.claims.licenseType'],
            filter: {
              type: 'string',
              pattern: 'medical_license|MedicalLicense',
            },
          },
        ],
      },
    },
  ],
};

function buildRequestUri(): string {
  const params = new URLSearchParams({
    client_id: 'did:key:zVerifier',
    response_type: 'vp_token',
    nonce: 'nonce-oid4vp',
    response_uri: 'https://verifier.example/oid4vp/response',
    presentation_definition: JSON.stringify(presentationDefinition),
  });

  return `openid4vp://authorize?${params.toString()}`;
}

describe('OID4VPHandler', () => {
  beforeEach(() => {
    secureStoreState.clear();
  });

  it('parses openid4vp URIs into a presentation request', () => {
    const handler = new OID4VPHandler();
    const request = handler.parseRequest(buildRequestUri());

    expect(request.client_id).toBe('did:key:zVerifier');
    expect(request.nonce).toBe('nonce-oid4vp');
    expect(request.presentation_definition.id).toBe('pd-1');
  });

  it('selects credentials that match input descriptors by type', async () => {
    const store = new LocalCredentialStore();
    await store.storeCredential(medicalLicense);
    await store.storeCredential(boardCertification);
    const handler = new OID4VPHandler(store, new OfflinePresentationEngine(store));

    const matched = await handler.selectCredentials(handler.parseRequest(buildRequestUri()));

    expect(matched.map((credential) => credential.id)).toEqual([medicalLicense.id]);
  });

  it('creates a local presentation when the verifier response URI is unreachable', async () => {
    const store = new LocalCredentialStore();
    await store.storeCredential(medicalLicense);

    const fetchImpl: typeof fetch = async (_input, init) => {
      if (init?.method === 'HEAD') {
        throw new Error('offline');
      }

      return new Response(null, { status: 503 });
    };

    const handler = new OID4VPHandler(
      store,
      new OfflinePresentationEngine(store),
      fetchImpl,
    );
    const handled = await handler.handleRequest(buildRequestUri());

    expect(handled.submitted).toBe(false);
    expect(handled.matchedCredentials.map((credential) => credential.id)).toEqual([
      medicalLicense.id,
    ]);
    expect(handled.presentation.vpJwt.length).toBeGreaterThan(0);
  });
});
