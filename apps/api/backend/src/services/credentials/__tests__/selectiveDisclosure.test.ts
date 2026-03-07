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

  it('normalizes reveal fields deterministically and excludes internal claims', () => {
    const credentialWithInternal: VerifiableCredential = {
      ...credential,
      claims: {
        zeta: 'z',
        _issuerHints: 'internal-only',
        alpha: 'a',
        npi: '1234567890',
      },
    };

    const { disclosure } = generateSelectiveDisclosure(credentialWithInternal, [
      'zeta',
      'missing',
      'alpha',
      'zeta',
      '_issuerHints',
    ]);

    expect(disclosure.disclosureFrame.revealFields).toEqual(['alpha', 'zeta']);
    expect(disclosure.revealedClaims).toEqual({
      alpha: 'a',
      zeta: 'z',
    });
    expect(disclosure.hiddenCommitments).toHaveProperty('npi');
    expect(disclosure.hiddenCommitments).not.toHaveProperty('_issuerHints');
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

  it('validates nested object claims using canonical field ordering', () => {
    const credentialWithObject: VerifiableCredential = {
      ...credential,
      claims: {
        ...credential.claims,
        details: {
          board: 'ABIM',
          issued: {
            year: 2024,
            month: 6,
          },
        },
      },
    };

    const { disclosure, salts } = generateSelectiveDisclosure(credentialWithObject, ['specialty']);
    const detailsCommitment = disclosure.hiddenCommitments['details'];

    expect(
      verifyCommitment(
        detailsCommitment,
        {
          issued: {
            month: 6,
            year: 2024,
          },
          board: 'ABIM',
        },
        salts['details'],
      ),
    ).toBe(true);
  });
});

describe('listCredentialFields', () => {
  it('lists all non-underscore claim fields', () => {
    const fields = listCredentialFields(credential);
    expect(fields).toContain('specialty');
    expect(fields).toContain('npi');
    expect(fields).toContain('boardCertified');
  });

  it('returns fields in deterministic sorted order', () => {
    const fields = listCredentialFields({
      ...credential,
      claims: {
        zeta: true,
        alpha: true,
        _internal: true,
        beta: true,
      },
    });

    expect(fields).toEqual(['alpha', 'beta', 'zeta']);
  });
});
