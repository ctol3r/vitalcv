import assert from 'node:assert/strict';
import test from 'node:test';
import type { JWK } from 'jose';
import { CsdJwtIssuer } from '../issuer';
import { CsdJwtVerifier } from '../verifier';
import { CredentialSchemaRegistry } from '../schemas';

const TEST_ED25519_JWK: JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  d: 'nWGxne5eF-8A_Q2W5n4G1-uvcEZh1Iia-pb1RNPk0vY',
  x: '11qYAYdk9JhiTmqnpnA8LebgG4n6f1v3s8pCqPpR5LA',
  kid: 'test-ed25519',
  alg: 'EdDSA',
};

test('CsdJwtIssuer issues credential with selective disclosure', async () => {
  const registry = new CredentialSchemaRegistry();
  const issuer = new CsdJwtIssuer({
    issuerDid: 'did:web:issuer.vitalcv.com',
    keyId: 'test-ed25519',
    signingKey: TEST_ED25519_JWK,
    schemaRegistry: registry,
  });

  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: 'did:web:issuer.vitalcv.com',
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      name: 'Dr. Jane Smith',
      npi: '1234567890',
      specialty: 'Cardiology',
    },
  };

  const result = await issuer.issue({
    schemaId: 'ClinicianIdentityVC',
    credential,
    revealGroups: ['identity-specialty'],
  });

  assert.ok(result.token);
  assert.equal(result.manifest.schemaId, 'ClinicianIdentityVC');
  assert.ok(result.disclosures.length >= 3);
});

test('CsdJwtVerifier validates disclosed claims', async () => {
  const registry = new CredentialSchemaRegistry();
  const issuer = new CsdJwtIssuer({
    issuerDid: 'did:web:issuer.vitalcv.com',
    keyId: 'test-ed25519',
    signingKey: TEST_ED25519_JWK,
    schemaRegistry: registry,
  });

  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: 'did:web:issuer.vitalcv.com',
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      name: 'Dr. Jane Smith',
      npi: '1234567890',
      specialty: 'Cardiology',
    },
  };

  const issued = await issuer.issue({
    schemaId: 'ClinicianIdentityVC',
    credential,
    revealGroups: ['identity-specialty'],
  });

  const verifier = new CsdJwtVerifier({
    schemaRegistry: registry,
    keyResolver: async () => {
      const { d, ...publicJwk } = TEST_ED25519_JWK;
      return publicJwk as JWK;
    },
  });

  const disclosures = issued.disclosures.filter((disclosure) =>
    ['identity-core', 'identity-specialty'].includes(disclosure.groupId),
  );

  const verification = await verifier.verify({
    csdJwt: issued.token,
    disclosures,
    revealGroups: ['identity-specialty'],
  });

  assert.equal(verification.valid, true);
  if (verification.valid) {
    assert.equal(verification.revealedClaims['credentialSubject.name'], 'Dr. Jane Smith');
    assert.equal(verification.revealedClaims['credentialSubject.specialty'], 'Cardiology');
  }
});

test('CsdJwtVerifier rejects tampered disclosures', async () => {
  const registry = new CredentialSchemaRegistry();
  const issuer = new CsdJwtIssuer({
    issuerDid: 'did:web:issuer.vitalcv.com',
    keyId: 'test-ed25519',
    signingKey: TEST_ED25519_JWK,
    schemaRegistry: registry,
  });

  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: 'did:web:issuer.vitalcv.com',
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      name: 'Dr. Jane Smith',
      npi: '1234567890',
      specialty: 'Cardiology',
    },
  };

  const issued = await issuer.issue({
    schemaId: 'ClinicianIdentityVC',
    credential,
  });

  const verifier = new CsdJwtVerifier({
    schemaRegistry: registry,
    keyResolver: async () => {
      const { d, ...publicJwk } = TEST_ED25519_JWK;
      return publicJwk as JWK;
    },
  });

  const tampered = issued.disclosures.map((disclosure) => {
    if (disclosure.path === 'credentialSubject.name') {
      return { ...disclosure, value: 'Dr. Mallory' };
    }
    return disclosure;
  });

  const verification = await verifier.verify({
    csdJwt: issued.token,
    disclosures: tampered,
  });

  assert.equal(verification.valid, false);
  if (!verification.valid) {
    assert.match(verification.error ?? '', /not registered|digest/i);
  }
});


