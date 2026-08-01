import request from 'supertest';
import app from '../../apps/api/backend/src/app';
import prisma from '../../apps/api/backend/src/graphql/prisma_client';
import { InMemoryTrustRegistryRepository } from '../../apps/api/backend/repositories/trustRegistry.repo';
import { issueCredential } from '../../apps/api/backend/src/services/credentials/credentialIssuer';
import {
  removeCredential,
  storeCredential,
} from '../../apps/api/backend/src/services/credentials/credentialWallet';
import {
  initializeTrustRegistryPersistence,
  registerIssuer,
  resetTrustRegistryRepository,
  setTrustRegistryRepository,
  type TrustedIssuer,
} from '../../apps/api/backend/src/services/registry/trustRegistry';
import type {
  FHIRBundle,
  ProviderDirectory,
} from '../../apps/api/backend/src/services/providers/providerDirectory';
import { sha256ForPayload, sha256Hex } from '../../apps/api/backend/src/utils/deterministic';
import { TEST_ORG_ID, TEST_PRIVATE_KEY_PEM, TEST_PUBLIC_KEY_PEM } from '../fixtures/issuer';

type ProviderFindManyPromise = ReturnType<typeof prisma.provider.findMany>;

function buildIssuer(): TrustedIssuer {
  return {
    issuerId: 'did:vitalcv:issuer:cx145-directory',
    issuerName: 'CX-145 Directory Issuer',
    publicKey: TEST_PUBLIC_KEY_PEM,
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2026-03-07T00:00:00.000Z',
    trustScore: 92,
    assuranceProfile: 'IAL2',
    algorithmPolicy: ['ES256'],
    haipCompliant: true,
  };
}

describe('Wave CX-145 provider directory', () => {
  const storedCredentialIds: string[] = [];
  const issuer = buildIssuer();
  const providers = [
    {
      npi: '8100000003',
      fullName: 'Provider Three',
      taxonomyCode: '207Q00000X',
      stateOfPractice: 'WA',
    },
    {
      npi: '8100000001',
      fullName: 'Provider One',
      taxonomyCode: '207R00000X',
      stateOfPractice: 'CA',
    },
    {
      npi: '8100000002',
      fullName: 'Provider Two',
      taxonomyCode: '207Q00000X',
      stateOfPractice: 'OR',
    },
  ];

  async function issueAndStoreCredential(params: {
    subject: string;
    type: string;
  }): Promise<void> {
    const credential = await issueCredential(
      {
        issuer: issuer.issuerId,
        subject: params.subject,
        claims: {
          type: params.type,
        },
      },
      TEST_PRIVATE_KEY_PEM,
    );
    storeCredential(credential);
    storedCredentialIds.push(credential.credentialId);
  }

  beforeAll(async () => {
    setTrustRegistryRepository(new InMemoryTrustRegistryRepository());
    await initializeTrustRegistryPersistence();
    await registerIssuer(issuer);

    await issueAndStoreCredential({
      subject: '8100000001',
      type: 'MedicalLicense',
    });
    await issueAndStoreCredential({
      subject: '8100000002',
      type: 'BoardCertification',
    });
  });

  afterAll(() => {
    for (const credentialId of storedCredentialIds) {
      removeCredential(credentialId);
    }
    jest.restoreAllMocks();
    resetTrustRegistryRepository();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.provider, 'findMany').mockReturnValue(
      Promise.resolve(providers) as unknown as ProviderFindManyPromise,
    );
  });

  test('returns sorted structured pages with additive pagination and integrity hash', async () => {
    const response = await request(app)
      .get('/api/directory')
      .set('x-org-id', TEST_ORG_ID)
      .query({ page: 1, pageSize: 2 });

    expect(response.status).toBe(200);

    const body = response.body as ProviderDirectory;
    expect(body.entries.map((entry) => entry.npi)).toEqual(['8100000001', '8100000002']);
    expect(body).toEqual(expect.objectContaining({
      totalProviders: 2,
      verifiedProviders: 2,
      format: 'structured',
      pageInfo: {
        page: 1,
        pageSize: 2,
        returned: 2,
        totalAvailable: 3,
        totalPages: 2,
        hasNextPage: true,
      },
    }));

    const { integrityHash, ...unsignedPayload } = body;
    expect(integrityHash).toBe(sha256ForPayload(unsignedPayload));
  });

  test('supports limit aliasing and clamps oversized page requests', async () => {
    const limitResponse = await request(app)
      .get('/api/directory')
      .set('x-org-id', TEST_ORG_ID)
      .query({ limit: 1 });

    expect(limitResponse.status).toBe(200);
    expect(limitResponse.body.entries).toHaveLength(1);
    expect(limitResponse.body.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 1,
      returned: 1,
      totalAvailable: 3,
      totalPages: 3,
      hasNextPage: true,
    }));

    const clampedResponse = await request(app)
      .get('/api/directory')
      .set('x-org-id', TEST_ORG_ID)
      .query({ pageSize: 5000 });

    expect(clampedResponse.status).toBe(200);
    expect(clampedResponse.body.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 1000,
      returned: 3,
      totalAvailable: 3,
      totalPages: 1,
      hasNextPage: false,
    }));
  });

  test('exports FHIR PractitionerRole bundles with organization references and no taxonomy', async () => {
    const response = await request(app)
      .get('/api/directory/fhir')
      .set('x-org-id', TEST_ORG_ID)
      .query({ page: 1, pageSize: 1 });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/fhir\+json/);

    const body = response.body as FHIRBundle;
    expect(body.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 1,
      returned: 1,
      totalAvailable: 3,
      totalPages: 3,
      hasNextPage: true,
    }));
    expect(body.link.map((link) => link.relation)).toEqual(expect.arrayContaining(['self', 'next']));

    const role = body.entry[0]?.resource;
    expect(role).toBeDefined();
    expect(role).toEqual(expect.objectContaining({
      resourceType: 'PractitionerRole',
      practitioner: expect.objectContaining({
        reference: 'Practitioner/8100000001',
      }),
      organization: expect.objectContaining({
        reference: 'Organization/vitalcv-provider-directory',
      }),
    }));
    expect(role.identifier).toEqual(expect.arrayContaining([
      expect.objectContaining({
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: '8100000001',
      }),
    ]));
    // P0.1 containment — the directory no longer publishes a NUCC taxonomy.
    // `Provider.taxonomyCode` is not source-backed, and both `code` and
    // `specialty` derive from it, so both are empty. FHIR treats an absent
    // element as "not stated", which is the honest reading; the previous
    // expectation pinned the fabricated code as the contract.
    expect(role.code).toEqual([]);
    expect(role.specialty).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('http://nucc.org/provider-taxonomy');
    expect(JSON.stringify(body)).not.toContain('207R00000X');

    const { integrityHash, ...unsignedPayload } = body;
    expect(integrityHash).toBe(sha256ForPayload(unsignedPayload));
  });

  test('exports CSV with integrity and pagination headers', async () => {
    const response = await request(app)
      .get('/api/directory/csv')
      .set('x-org-id', TEST_ORG_ID)
      .query({ page: 1, pageSize: 2 });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.headers['x-vitalcv-integrity-hash']).toBe(sha256Hex(response.text));
    expect(response.headers['x-vitalcv-page']).toBe('1');
    expect(response.headers['x-vitalcv-page-size']).toBe('2');
    expect(response.headers['x-vitalcv-total-available']).toBe('3');
    expect(response.headers['x-vitalcv-has-next-page']).toBe('true');
    expect(response.text.split('\n')[0]).toBe(
      'NPI,FullName,Specialties,CredentialCount,ActiveCredentials,PrimaryIssuer,CredentialHealth,LastVerifiedAt,TrustScore',
    );
  });
});
