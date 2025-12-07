import { PassportStore } from '../passportStore';

const mockPrisma = {
  walletCredential: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

const sampleInput = {
  passportId: 'pass-1',
  clinicianId: 'clin-1',
  deviceId: 'device-1',
  version: '3.0',
  hash: 'abc123',
  issuedAt: new Date().toISOString(),
  ciphertext: 'cipher',
  iv: 'iv-base64',
  authTag: 'tag-base64',
  envelopeSummary: { credentialCount: 2 },
  signature: {
    anchorId: 'anchor-1',
    signature: 'deadbeef',
    publicKey: 'beadfeed',
    algorithm: 'Ed25519',
    timestamp: new Date().toISOString(),
  },
};

describe('PassportStore', () => {
  let store: PassportStore;

  beforeEach(() => {
    jest.resetAllMocks();
    store = new PassportStore(mockPrisma as any);
  });

  it('persists passports via upsert', async () => {
    const upsertResult = { credentialId: 'pass-1' };
    mockPrisma.walletCredential.upsert.mockResolvedValue(upsertResult);

    const result = await store.save(sampleInput);

    expect(result).toBe(upsertResult);
    expect(mockPrisma.walletCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { credentialId: sampleInput.passportId },
        create: expect.objectContaining({
          clinicianId: sampleInput.clinicianId,
          type: 'PassportV3',
        }),
      }),
    );
  });

  it('revokes older versions for clinician', async () => {
    await store.revokeOlderVersions('clin-2', 'keep-pass', 'rotated');
    expect(mockPrisma.walletCredential.updateMany).toHaveBeenCalledWith({
      where: {
        clinicianId: 'clin-2',
        type: 'PassportV3',
        credentialId: { not: 'keep-pass' },
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        payload: { reason: 'rotated' },
      },
    });
  });

  it('marks passport as revoked', async () => {
    mockPrisma.walletCredential.update.mockResolvedValue({ credentialId: 'pass-1' });
    const result = await store.markRevoked({ passportId: 'pass-1', reason: 'compromised' });
    expect(result).toEqual({ credentialId: 'pass-1' });
    expect(mockPrisma.walletCredential.update).toHaveBeenCalledWith({
      where: { credentialId: 'pass-1' },
      data: {
        revokedAt: expect.any(Date),
        payload: { reason: 'compromised' },
      },
    });
  });

  it('fetches passport by id', async () => {
    const record = { credentialId: 'pass-lookup' };
    mockPrisma.walletCredential.findUnique.mockResolvedValue(record);
    const fetched = await store.getPassport('pass-lookup');
    expect(fetched).toBe(record);
  });
});

