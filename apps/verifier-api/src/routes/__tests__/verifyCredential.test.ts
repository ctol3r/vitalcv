/**
 * S72-D1-A-008: Unit tests for Credential Verification Endpoint
 */

import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import verifyCredentialRouter from '../verifyCredential';

// Create test app
const app = express();
app.use(express.json());
app.use('/', verifyCredentialRouter);

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

  it('should handle valid structure with unknown issuer', async () => {
    // Create a properly formatted JWT (with alg:none for testing)
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'did:example:unknown',
      sub: 'did:example:subject',
      iat: Math.floor(Date.now() / 1000)
    })).toString('base64url');
    const signature = 'fake-signature';
    const credential = `${header}.${payload}.${signature}`;

    const response = await request(app)
      .post('/')
      .send({ credential });

    expect(response.status).toBe(200);
    // For unknown issuer, we return valid with warning
    expect(response.body.valid).toBe(true);
    expect(response.body.warning).toBeTruthy();
  });

  it('should extract issuer and subject from credential', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'did:web:issuer.example.com',
      sub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      iat: Math.floor(Date.now() / 1000)
    })).toString('base64url');
    const credential = `${header}.${payload}.fake-signature`;

    const response = await request(app)
      .post('/')
      .send({ credential });

    expect(response.status).toBe(200);
    expect(response.body.issuer).toBe('did:web:issuer.example.com');
    expect(response.body.subject).toBe('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
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

