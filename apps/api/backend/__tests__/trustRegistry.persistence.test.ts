import { InMemoryTrustRegistryRepository } from '../repositories/trustRegistry.repo';
import {
  getIssuer,
  initializeTrustRegistryPersistence,
  registerIssuer,
  resetTrustRegistryRepository,
  setTrustRegistryRepository,
  updateIssuerReputation,
  updateIssuerStatus,
} from '../src/services/registry/trustRegistry';

const TEST_ISSUER_ID = 'did:vitalcv:test:persistence';

describe('trustRegistry persistence', () => {
  let repository: InMemoryTrustRegistryRepository;

  beforeEach(async () => {
    repository = new InMemoryTrustRegistryRepository();
    setTrustRegistryRepository(repository);
    await initializeTrustRegistryPersistence();
  });

  afterEach(() => {
    resetTrustRegistryRepository();
  });

  test('persists registered issuers across cache reinitialization', async () => {
    await registerIssuer({
      issuerId: TEST_ISSUER_ID,
      issuerName: 'Persistence Test Issuer',
      publicKey: '',
      trustLevel: 'TRUSTED',
      status: 'ACTIVE',
      registeredAt: '2026-03-06T12:00:00.000Z',
      metadata: { verificationEndpoint: 'https://issuer.example/verify' },
    });

    setTrustRegistryRepository(repository);
    await initializeTrustRegistryPersistence();

    const issuer = getIssuer(TEST_ISSUER_ID);
    expect(issuer).not.toBeNull();
    expect(issuer?.issuerName).toBe('Persistence Test Issuer');
    expect(issuer?.metadata).toEqual({ verificationEndpoint: 'https://issuer.example/verify' });
  });

  test('persists status and reputation updates', async () => {
    await registerIssuer({
      issuerId: TEST_ISSUER_ID,
      issuerName: 'Persistence Test Issuer',
      publicKey: '',
      trustLevel: 'PROVISIONAL',
      status: 'ACTIVE',
      registeredAt: '2026-03-06T12:00:00.000Z',
    });

    await updateIssuerStatus(TEST_ISSUER_ID, 'SUSPENDED');
    await updateIssuerReputation(TEST_ISSUER_ID, {
      trustScore: 61,
      verificationCount: 44,
      revocationCount: 1,
    });

    setTrustRegistryRepository(repository);
    await initializeTrustRegistryPersistence();

    const issuer = getIssuer(TEST_ISSUER_ID);
    expect(issuer).not.toBeNull();
    expect(issuer?.status).toBe('SUSPENDED');
    expect(issuer?.trustScore).toBe(61);
    expect(issuer?.verificationCount).toBe(44);
    expect(issuer?.revocationCount).toBe(1);
    expect(issuer?.lastScoredAt).toBeDefined();
  });
});
