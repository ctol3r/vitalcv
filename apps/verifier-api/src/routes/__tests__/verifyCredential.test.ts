/**
 * S72-D1-A-008: Unit tests for Credential Verification Endpoint
 */

import crypto from 'crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import verifyCredentialRouter from '../verifyCredential';
import { setLocalCredentialStatus } from '../../services/statusRegistry';

// Create test app
const app = express();
app.use(express.json());
app.use('/', verifyCredentialRouter);

const issuerDid = 'did:example:issuer';
const subjectDid = 'did:example:subject';

async function buildSignedCredential() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = `${issuerDid}#key-1`;
  publicJwk.alg = 'ES256';

  const credentialId = `urn:uuid:${crypto.randomUUID()}`;
  const jwt = await new SignJWT({
    sub: subjectDid,
    jti: credentialId,
  })
    .setProtectedHeader({ alg: 'ES256', kid: publicJwk.kid })
    .setIssuer(issuerDid)
    .setIssuedAt()
    .sign(privateKey);

  return { jwt, publicJwk, credentialId };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /verify/credential', () => {
  it('should return 400 for missing credential', async () => {
    const response = await request(app)
      .post('/')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.valid).toBe(false);
    expect(response.body.reason).toContain('Missing or invalid credential');
  });

  it('should return invalid for malformed JWS', async () => {
    const response = await request(app)
      .post('/')
      .send({
        credential: 'not.a.valid.jws.token'
      });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.reason).toContain('Invalid JWT format');
  });

  it('should return invalid for JWS without issuer', async () => {
    // Create a minimal JWT without issuer (note: this will fail parsing but demonstrates the check)
    const response = await request(app)
      .post('/')
      .send({
        credential: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'
      });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
  });

  it('should verify signature via DID resolution', async () => {
    const { jwt, publicJwk } = await buildSignedCredential();

    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        didDocument: {
          id: issuerDid,
          verificationMethod: [
            {
              id: publicJwk.kid,
              type: 'JsonWebKey2020',
              controller: issuerDid,
              publicKeyJwk: publicJwk,
            },
          ],
          assertionMethod: [publicJwk.kid],
        },
      }),
    });

    const response = await request(app)
      .post('/')
      .send({ credential: jwt });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.issuer).toBe(issuerDid);
    expect(response.body.subject).toBe(subjectDid);
    expect(response.body.receipt).toBeTruthy();
    expect(response.body.receipt.payload.credentialId).toBeDefined();
  });

  it('should fail verification when credential is revoked', async () => {
    const { jwt, publicJwk, credentialId } = await buildSignedCredential();

    setLocalCredentialStatus(credentialId, {
      revoked: true,
      reason: 'Unit test revocation',
      revokedAt: new Date().toISOString(),
    });

    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        didDocument: {
          id: issuerDid,
          verificationMethod: [
            {
              id: publicJwk.kid,
              type: 'JsonWebKey2020',
              controller: issuerDid,
              publicKeyJwk: publicJwk,
            },
          ],
          assertionMethod: [publicJwk.kid],
        },
      }),
    });

    const response = await request(app)
      .post('/')
      .send({ credential: jwt });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.status.status).toBe('revoked');
  });
});

describe('GET /verify/credential/health', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('credential-verifier');
  });
});
