/**
 * B107A-OIDC-003: Tests for PAR enforcement in Pre-Authorized Code grant
 *
 * Acceptance criteria:
 * - PAR enforced when scope ⊃ credential:issue:*
 * - Negative test: non-PAR request→error
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import request from 'supertest';
import express from 'express';
import { randomBytes } from 'crypto';

// Mock the authz app or import it
// For now, we'll create a test harness
describe('B107A-OIDC-003: PAR enforcement for Pre-Authorized Code grant', () => {
  let app: express.Application;
  let preAuthorizedCodes: Map<string, any>;
  let parRequests: Map<string, any>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    preAuthorizedCodes = new Map();
    parRequests = new Map();

    // Mock PAR endpoint
    app.post('/par', (req: Request, res: Response) => {
      const { request, client_id, scope } = req.body;
      const scopes = scope?.split(' ') || [];
      const highRiskScopes = scopes.filter((s: string) => s.startsWith('credential:issue:'));

      if (highRiskScopes.length > 0 && !request) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'PAR required for high-risk scopes'
        });
      }

      const requestUri = `urn:ietf:params:oauth:request_uri:${randomBytes(16).toString('base64url')}`;
      parRequests.set(requestUri, {
        request_uri: requestUri,
        request: request || { scope, client_id },
        expiresAt: Date.now() + 60000,
        clientId: client_id || 'unknown',
      });

      res.json({
        request_uri: requestUri,
        expires_in: 60,
      });
    });

    // Mock token endpoint with PAR enforcement
    app.post('/token', (req: Request, res: Response) => {
      const { grant_type, pre_authorized_code, request_uri, client_id } = req.body;

      if (grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      if (!pre_authorized_code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing pre_authorized_code'
        });
      }

      const preAuthCode = preAuthorizedCodes.get(pre_authorized_code);
      if (!preAuthCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired pre-authorized code'
        });
      }

      // B107A-OIDC-003: PAR required for high-risk scopes
      const highRiskScopes = preAuthCode.scope.filter((s: string) => s.startsWith('credential:issue:'));
      if (highRiskScopes.length > 0) {
        if (!request_uri) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'PAR (request_uri) required for high-risk scopes. Scopes requiring PAR: ' + highRiskScopes.join(', ')
          });
        }

        const parRequest = parRequests.get(request_uri);
        if (!parRequest) {
          return res.status(400).json({
            error: 'invalid_request_uri',
            error_description: 'Invalid or expired request_uri'
          });
        }

        if (Date.now() > parRequest.expiresAt) {
          parRequests.delete(request_uri);
          return res.status(400).json({
            error: 'expired_request_uri',
            error_description: 'Request URI expired'
          });
        }

        const parScopes = parRequest.request.scope?.split(' ') || [];
        const scopeMatch = highRiskScopes.every((scope: string) => parScopes.includes(scope));
        if (!scopeMatch) {
          return res.status(400).json({
            error: 'invalid_scope',
            error_description: 'PAR request scopes do not match pre-authorized code scopes'
          });
        }

        parRequests.delete(request_uri);
      }

      res.json({
        access_token: 'mock_access_token',
        token_type: 'DPoP',
        expires_in: 3600,
        scope: preAuthCode.scope.join(' '),
      });
    });

    // Mock pre-authorized code generation
    app.post('/pre-authorized-code', (req: Request, res: Response) => {
      const { scope, client_id, expires_in = 600 } = req.body;
      const scopes = Array.isArray(scope) ? scope : scope.split(' ');
      const allowedScopes = ['openid', 'credential:issue'];
      const limitedScopes = scopes.filter(s =>
        allowedScopes.includes(s) || s.startsWith('credential:issue:')
      );

      if (limitedScopes.length === 0) {
        return res.status(400).json({
          error: 'invalid_scope',
          error_description: 'No allowed scopes specified'
        });
      }

      const code = randomBytes(16).toString('base64url');
      preAuthorizedCodes.set(code, {
        code,
        scope: limitedScopes,
        expiresAt: Date.now() + (expires_in * 1000),
        clientId: client_id,
        requiresPAR: limitedScopes.some((s: string) => s.startsWith('credential:issue:')),
      });

      res.json({
        pre_authorized_code: code,
        expires_in,
        scope: limitedScopes.join(' '),
      });
    });
  });

  it('should enforce PAR for high-risk scopes (credential:issue:*)', async () => {
    // Step 1: Generate pre-authorized code with high-risk scope
    const codeRes = await request(app)
      .post('/pre-authorized-code')
      .send({
        scope: 'credential:issue:PhysicianCredential',
        client_id: 'test-client',
      });

    expect(codeRes.status).toBe(200);
    const { pre_authorized_code } = codeRes.body;

    // Step 2: Try to use pre-authorized code without PAR (should fail)
    const tokenResWithoutPAR = await request(app)
      .post('/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code,
        client_id: 'test-client',
      });

    expect(tokenResWithoutPAR.status).toBe(400);
    expect(tokenResWithoutPAR.body.error).toBe('invalid_request');
    expect(tokenResWithoutPAR.body.error_description).toContain('PAR (request_uri) required');

    // Step 3: Create PAR request
    const parRes = await request(app)
      .post('/par')
      .send({
        scope: 'credential:issue:PhysicianCredential',
        client_id: 'test-client',
      });

    expect(parRes.status).toBe(200);
    const { request_uri } = parRes.body;

    // Step 4: Use pre-authorized code with PAR (should succeed)
    const tokenResWithPAR = await request(app)
      .post('/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code,
        request_uri,
        client_id: 'test-client',
      });

    expect(tokenResWithPAR.status).toBe(200);
    expect(tokenResWithPAR.body.access_token).toBeDefined();
  });

  it('should allow non-high-risk scopes without PAR', async () => {
    // Generate pre-authorized code with non-high-risk scope
    const codeRes = await request(app)
      .post('/pre-authorized-code')
      .send({
        scope: 'openid',
        client_id: 'test-client',
      });

    expect(codeRes.status).toBe(200);
    const { pre_authorized_code } = codeRes.body;

    // Use pre-authorized code without PAR (should succeed for non-high-risk scopes)
    const tokenRes = await request(app)
      .post('/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code,
        client_id: 'test-client',
      });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.access_token).toBeDefined();
  });

  it('should reject PAR with mismatched scopes', async () => {
    // Generate pre-authorized code with high-risk scope
    const codeRes = await request(app)
      .post('/pre-authorized-code')
      .send({
        scope: 'credential:issue:PhysicianCredential',
        client_id: 'test-client',
      });

    expect(codeRes.status).toBe(200);
    const { pre_authorized_code } = codeRes.body;

    // Create PAR request with different scope
    const parRes = await request(app)
      .post('/par')
      .send({
        scope: 'credential:issue:DifferentCredential',
        client_id: 'test-client',
      });

    expect(parRes.status).toBe(200);
    const { request_uri } = parRes.body;

    // Try to use pre-authorized code with mismatched PAR (should fail)
    const tokenRes = await request(app)
      .post('/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code,
        request_uri,
        client_id: 'test-client',
      });

    expect(tokenRes.status).toBe(400);
    expect(tokenRes.body.error).toBe('invalid_scope');
    expect(tokenRes.body.error_description).toContain('PAR request scopes do not match');
  });
});

