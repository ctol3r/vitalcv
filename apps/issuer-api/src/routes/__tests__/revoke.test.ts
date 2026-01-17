/**
 * Tests for credential revocation endpoint
 */

import express from 'express';
import { exportJWK, generateKeyPair } from 'jose';
import supertest, { type Test } from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { allocateStatusListEntry, clearInMemoryAllocations } from '../../services/statusList';
import revokeRouter from '../revoke';

// Set up test environment
process.env.NODE_ENV = 'test';

const app = express();
app.use(express.json());
app.use('/revoke', revokeRouter);
type SupertestClient = {
  post: (path: string) => Test;
};
const api = supertest(app) as unknown as SupertestClient;

beforeAll(async () => {
  // Set up signing key for audit receipts
  if (!process.env.VC_SIGNING_KEY_JWK) {
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true });
    const jwk = await exportJWK(privateKey);
    jwk.kid = 'test-issuer-key';
    process.env.VC_SIGNING_KEY_JWK = JSON.stringify(jwk);
  }
});

beforeEach(() => {
  // Clear in-memory status allocations before each test
  clearInMemoryAllocations();
});

describe('POST /revoke', () => {
  it('should revoke an existing credential', async () => {
    // First allocate a status list entry
    const credentialId = 'test-credential-001';
    await allocateStatusListEntry(credentialId);

    // Then revoke it
    const response = await api.post('/revoke').send({ credential_id: credentialId }).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.credential_id).toBe(credentialId);
    expect(response.body.revoked).toBe(true);
    expect(response.body.already_revoked).toBe(false);
  });

  it('should be idempotent (revoking twice returns already_revoked)', async () => {
    const credentialId = 'test-credential-002';
    await allocateStatusListEntry(credentialId);

    // First revocation
    await api.post('/revoke').send({ credential_id: credentialId }).expect(200);

    // Second revocation (should indicate already revoked)
    const response = await api.post('/revoke').send({ credential_id: credentialId }).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.already_revoked).toBe(true);
    expect(response.body.revoked).toBe(false);
  });

  it('should return 400 if credential_id is missing', async () => {
    const response = await api.post('/revoke').send({}).expect(400);

    expect(response.body.error).toBe('invalid_request');
    expect(response.body.error_description).toContain('credential_id is required');
  });

  it('should return 400 if credential_id is not a string', async () => {
    const response = await api.post('/revoke').send({ credential_id: 12345 }).expect(400);

    expect(response.body.error).toBe('invalid_request');
  });

  it('should return 404 if credential not found in status list', async () => {
    const response = await api
      .post('/revoke')
      .send({ credential_id: 'non-existent-credential' })
      .expect(404);

    expect(response.body.error).toBe('credential_not_found');
  });

  it('should accept optional reason parameter', async () => {
    const credentialId = 'test-credential-003';
    await allocateStatusListEntry(credentialId);

    const response = await api
      .post('/revoke')
      .send({
        credential_id: credentialId,
        reason: 'User requested revocation',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should accept optional list_id parameter', async () => {
    const credentialId = 'test-credential-004';
    const listId = 'custom-list';
    await allocateStatusListEntry(credentialId, listId);

    const response = await api
      .post('/revoke')
      .send({
        credential_id: credentialId,
        list_id: listId,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
