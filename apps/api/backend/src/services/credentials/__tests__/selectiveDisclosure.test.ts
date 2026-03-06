/**
 * Unit tests for selective disclosure — Wave 121
 *
 * Tests pure functions: generateSelectiveDisclosure, verifyCommitment, listCredentialFields.
 * No Prisma / network calls.
 */

import {
  generateSelectiveDisclosure,
  verifyCommitment,
  listCredentialFields,
} from '../selectiveDisclosure';
import type { VerifiableCredential } from '../credentialModel';

const credential: VerifiableCredential = {
  credentialId: 'vc:vitalcv:test:001',
  issuer: 'did:vitalcv:issuer:abim',
  subject: 'did:vitalcv:holder:npi-1234567890',
  issuedAt: new Date().toISOString(),
  status: 'ACTIVE',
  schemaVersion: '1.0',
  claims: {
    specialty: 'Internal Medicine',
    boardCertified: true,
    npi: '1234567890',
    state: 'CA',
    licenseNumber: 'A12345',
  },
  signature: 'fake-sig',
};

describe('generateSelectiveDisclosure', () => {
  it('reveals only the requested fields', () => {
    const { disclosure } = generateSelectiveDisclosure(credential, ['specialty', 'boardCertified']);
    expect(disclosure.revealedClaims).toHaveProperty('specialty', 'Internal Medicine');
    expect(disclosure.revealedClaims).toHaveProperty('boardCertified', true);
    expect(disclosure.revealedClaims).not.toHaveProperty('npi');
    expect(disclosure.revealedClaims).not.toHaveProperty('state');
  });

  it('produces a hidden commitment for non-revealed fields', () => {
    const { disclosure } = generateSelectiveDisclosure(credential, ['specialty']);
    expect(disclosure.hiddenCommitments).toHaveProperty('npi');
    expect(disclosure.hiddenCommitments).toHaveProperty('state');
    expect(disclosure.hiddenCommitments).toHaveProperty('licenseNumber');
  });

  it('returns salts for non-revealed fields', () => {
    const { salts } = generateSelectiveDisclosure(credential, ['specialty']);
    expect(salts).toHaveProperty('npi');
    expect(salts['npi']).toHaveLength(32); // 16 bytes hex
  });

  it('preserves the credentialId in the disclosure', () => {
    const { disclosure } = generateSelectiveDisclosure(credential, []);
    expect(disclosure.credentialId).toBe(credential.credentialId);
  });
});

describe('verifyCommitment', () => {
  it('validates a correct commitment with matching salt', () => {
    const { disclosure, salts } = generateSelectiveDisclosure(credential, ['specialty']);
    const npiCommitment = disclosure.hiddenCommitments['npi'];
    const npiSalt = salts['npi'];
    expect(verifyCommitment(npiCommitment, credential.claims['npi'], npiSalt)).toBe(true);
  });

  it('rejects a commitment with wrong salt', () => {
    const { disclosure } = generateSelectiveDisclosure(credential, ['specialty']);
    const npiCommitment = disclosure.hiddenCommitments['npi'];
    expect(verifyCommitment(npiCommitment, credential.claims['npi'], 'wrong-salt')).toBe(false);
  });

  it('rejects a commitment with wrong value', () => {
    const { disclosure, salts } = generateSelectiveDisclosure(credential, ['specialty']);
    const npiCommitment = disclosure.hiddenCommitments['npi'];
    expect(verifyCommitment(npiCommitment, 'wrong-value', salts['npi'])).toBe(false);
  });
});

describe('listCredentialFields', () => {
  it('lists all non-underscore claim fields', () => {
    const fields = listCredentialFields(credential);
    expect(fields).toContain('specialty');
    expect(fields).toContain('npi');
    expect(fields).toContain('boardCertified');
  });
});
