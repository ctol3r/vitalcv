import { PrismaClient } from '@prisma/client';
import {
  createWalletDevice,
  getWalletDeviceById,
  normalizePublicKeyJwk,
  normalizeWalletDeviceRegistration,
  touchWalletDevice,
} from '../WalletDevice';

const mockPrisma = {
  walletDevice: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

const ED25519_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'ZrJQfV8r4VQpMZDtuQY9EqG6cYb5GXkij5vtc1ZQHqo',
  alg: 'EdDSA',
};

describe('WalletDevice model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes valid Ed25519 keys', () => {
    const normalized = normalizePublicKeyJwk(ED25519_JWK);
    expect(normalized.alg).toBe('EdDSA');
  });

  it('rejects invalid curves', () => {
    expect(() =>
      normalizePublicKeyJwk({
        ...ED25519_JWK,
        crv: 'X25519',
      })
    ).toThrow('OKP keys must use Ed25519 curve');
  });

  it('creates wallet devices with sanitized metadata', async () => {
    const now = new Date();
    const createResponse = {
      deviceId: '11111111-2222-3333-4444-555555555555',
      clinicianId: 'clinician-123',
      publicKeyJwk: ED25519_JWK,
      metadata: { label: 'Primary iPhone' },
      createdAt: now,
      lastUsedAt: null,
    };

    (mockPrisma.walletDevice.create as jest.Mock).mockResolvedValue(createResponse);

    const result = await createWalletDevice(mockPrisma, {
      clinicianId: ' clinician-123 ',
      publicKeyJwk: ED25519_JWK,
      metadata: {
        label: ' Primary iPhone ',
      },
    });

    expect(result).toEqual(createResponse);
    expect(mockPrisma.walletDevice.create).toHaveBeenCalledWith({
      data: {
        clinicianId: 'clinician-123',
        publicKeyJwk: normalizePublicKeyJwk(ED25519_JWK),
        metadata: {
          label: 'Primary iPhone',
        },
      },
    });
  });

  it('retrieves wallet device by id', async () => {
    const device = { ...ED25519_JWK, deviceId: 'dev-1' } as any;
    (mockPrisma.walletDevice.findUnique as jest.Mock).mockResolvedValue(device);

    const result = await getWalletDeviceById(mockPrisma, 'dev-1');
    expect(result).toBe(device);
    expect(mockPrisma.walletDevice.findUnique).toHaveBeenCalledWith({
      where: { deviceId: 'dev-1' },
    });
  });

  it('updates lastUsedAt when touching device', async () => {
    const device = { deviceId: 'dev-2' } as any;
    (mockPrisma.walletDevice.update as jest.Mock).mockResolvedValue(device);

    const result = await touchWalletDevice(mockPrisma, 'dev-2');

    expect(result).toBe(device);
    expect(mockPrisma.walletDevice.update).toHaveBeenCalledWith({
      where: { deviceId: 'dev-2' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('normalizes metadata & jwk from schema', () => {
    const payload = normalizeWalletDeviceRegistration({
      clinicianId: 'clin-1',
      publicKeyJwk: { ...ED25519_JWK, alg: undefined },
      metadata: { label: ' Primary ' },
    });

    expect(payload.publicKeyJwk.alg).toBe('EdDSA');
    expect(payload.metadata?.label).toBe('Primary');
  });
});

