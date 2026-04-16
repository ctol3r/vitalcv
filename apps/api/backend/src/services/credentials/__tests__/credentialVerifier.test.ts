jest.mock('jose', () => ({
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../registry/trustRegistry', () => ({
  initializeTrustRegistryPersistence: jest.fn(),
  validateIssuerForVerification: jest.fn(),
}));

jest.mock('../../identity/didRegistry', () => ({
  resolveDID: jest.fn(),
}));

jest.mock('../../revocation/revocationRegistry', () => ({
  isRevoked: jest.fn(),
}));

jest.mock('../../trust/haipProfile', () => ({
  HAIP_HEALTHCARE_POLICY: {},
  checkCredentialHAIP: jest.fn(() => ({ compliant: true, violations: [] })),
  checkIssuerHAIP: jest.fn(() => ({ compliant: true })),
}));

import { importSPKI, jwtVerify } from 'jose';
import { log } from '../../../obs/logger';
import { verifyCredential } from '../credentialVerifier';
import {
  initializeTrustRegistryPersistence,
  validateIssuerForVerification,
} from '../../registry/trustRegistry';
import { resolveDID } from '../../identity/didRegistry';
import { isRevoked } from '../../revocation/revocationRegistry';
import type { VerifiableCredential } from '../credentialModel';

const importSPKIMock = importSPKI as jest.MockedFunction<typeof importSPKI>;
const jwtVerifyMock = jwtVerify as jest.MockedFunction<typeof jwtVerify>;
const logMock = log as jest.MockedFunction<typeof log>;
const initializeTrustRegistryPersistenceMock =
  initializeTrustRegistryPersistence as jest.MockedFunction<typeof initializeTrustRegistryPersistence>;
const validateIssuerForVerificationMock =
  validateIssuerForVerification as jest.MockedFunction<typeof validateIssuerForVerification>;
const resolveDIDMock = resolveDID as jest.MockedFunction<typeof resolveDID>;
const isRevokedMock = isRevoked as jest.MockedFunction<typeof isRevoked>;

function buildCredential(overrides: Partial<VerifiableCredential> = {}): VerifiableCredential {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  return {
    credentialId: 'cred-1',
    issuer: 'did:vitalcv:issuer:npi-registry',
    subject: '1234567890',
    claims: { npi: '1234567890' },
    signature: `${header}.payload.signature`,
    status: 'ACTIVE',
    issuedAt: '2026-04-14T00:00:00.000Z',
    schemaVersion: '1.0',
    ...overrides,
  };
}

describe('verifyCredential', () => {
  beforeEach(() => {
    importSPKIMock.mockReset().mockResolvedValue('public-key' as never);
    jwtVerifyMock.mockReset().mockResolvedValue({} as never);
    logMock.mockReset();
    initializeTrustRegistryPersistenceMock.mockReset().mockResolvedValue();
    validateIssuerForVerificationMock.mockReset().mockReturnValue({
      ok: true,
      issuer: {
        issuerId: 'did:vitalcv:issuer:npi-registry',
        issuerName: 'NPI Registry',
        publicKey: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
        trustLevel: 'AUTHORITATIVE',
        status: 'ACTIVE',
        registeredAt: '2025-01-01T00:00:00.000Z',
      },
      reason: null,
    });
    resolveDIDMock.mockReset().mockReturnValue(null);
    isRevokedMock.mockReset().mockReturnValue(null);
  });

  it('verifies signatures with strict ES256 constraints', async () => {
    const result = await verifyCredential(buildCredential());

    expect(importSPKIMock).toHaveBeenCalledWith(
      '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
      'ES256',
    );
    expect(jwtVerifyMock).toHaveBeenCalledWith(
      expect.any(String),
      'public-key',
      expect.objectContaining({
        algorithms: ['ES256'],
        issuer: 'did:vitalcv:issuer:npi-registry',
        subject: '1234567890',
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects issuers that are not active in the trust registry', async () => {
    validateIssuerForVerificationMock.mockReturnValue({
      ok: false,
      issuer: null,
      reason: 'issuer_not_registered',
    });
    resolveDIDMock.mockReturnValue({
      did: 'did:vitalcv:issuer:npi-registry',
      controller: 'did:vitalcv:issuer:npi-registry',
      publicKey: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
      subjectType: 'issuer',
      createdAt: '2025-01-01T00:00:00.000Z',
      status: 'ACTIVE',
    });

    const result = await verifyCredential(buildCredential());

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Issuer "did:vitalcv:issuer:npi-registry" not found in trust registry');
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(
      'warn',
      'registry.validation.failed',
      expect.objectContaining({
        issuer: 'did:vitalcv:issuer:npi-registry',
        reason: 'issuer_not_registered',
      }),
    );
  });

  it('rejects compact JWTs that do not declare ES256', async () => {
    const badHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const result = await verifyCredential(
      buildCredential({
        signature: `${badHeader}.payload.signature`,
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unsupported JWT alg: HS256');
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });
});
