/**
 * ES256 receipt engine — unit tests.
 *
 * Covers:
 *   - generateReceiptKeypair produces extractable ES256 keys
 *   - signIssuerReceipt returns a valid JWT with correct payload shape
 *   - getPublicKeyJwk returns a JWKS-safe object (no private key material)
 *   - buildAndSignReceiptCandidate attaches JWT only for 'confirmed' status
 */

import { describe, it, expect } from 'vitest';
import { jwtVerify, importJWK } from 'jose';
import {
  generateReceiptKeypair,
  signIssuerReceipt,
  getPublicKeyJwk,
} from '../lib/crypto/receiptIssuer';
import { buildAndSignReceiptCandidate } from '../lib/crypto/receiptCandidateSigner';
import type { IssuerVerificationRequest, IssuerResponse } from '../lib/issuer-verification/types';

// Minimal fixture helpers
function makeResponse(status: IssuerResponse['status'] = 'confirmed'): IssuerResponse {
  return {
    responseId: 'resp-001',
    status,
    respondedAt: '2026-01-15T10:00:00Z',
    responderName: 'Registrar Office',
    reviewRequired: false,
  };
}

function makeRequest(): IssuerVerificationRequest {
  return {
    requestId: 'req-001',
    claimType: 'education_degree',
    claimSummary: 'MD — State University School of Medicine',
    issuerCandidate: {
      candidateId: 'ic-001',
      organizationName: 'State University',
      source: 'clinician_provided',
    },
    route: {
      route: 'clearinghouse_or_registrar',
      partnerCategory: 'student_clearinghouse_degreeverify_category',
      rationale: 'Degree verification via clearinghouse',
      accessLevel: 'available',
    },
    consent: {
      consentId: 'consent-001',
      scope: 'education_degree',
      status: 'granted',
      consentedAt: '2026-01-10T08:00:00Z',
    },
    status: 'confirmed',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    history: [],
  };
}

describe('generateReceiptKeypair', () => {
  it('returns a keypair with a kid', async () => {
    const kp = await generateReceiptKeypair();
    expect(kp.kid).toMatch(/^vcv-es256-/);
    expect(kp.privateKey).toBeDefined();
    expect(kp.publicKey).toBeDefined();
  });

  it('produces distinct key material on each call', async () => {
    const kp1 = await generateReceiptKeypair();
    const kp2 = await generateReceiptKeypair();
    // Export both public keys and compare x/y coordinates.
    const { exportJWK } = await import('jose');
    const jwk1 = await exportJWK(kp1.publicKey);
    const jwk2 = await exportJWK(kp2.publicKey);
    // EC P-256 x coordinates are astronomically unlikely to collide.
    expect(jwk1.x).not.toBe(jwk2.x);
  });
});

describe('getPublicKeyJwk', () => {
  it('returns a JWK without the private key component (no d field)', async () => {
    const jwk = await getPublicKeyJwk();
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.alg).toBe('ES256');
    expect(jwk.use).toBe('sig');
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();
    // The 'd' field is the private key component — must be absent
    expect(jwk.d).toBeUndefined();
  });
});

describe('signIssuerReceipt', () => {
  it('produces a verifiable ES256 JWT with correct payload structure', async () => {
    const kp = await generateReceiptKeypair();
    const response = makeResponse();

    // Sign with the ephemeral keypair's private key by temporarily
    // replacing the module singleton via env — use signIssuerReceipt directly
    // and verify with the matching public key.
    const { jwt, jti } = await signIssuerReceipt(response, {
      providerId: 'npi-1234567890',
      claimId: 'claim-001',
      source: 'State University',
      rawHash: 'abc123',
    });

    expect(typeof jwt).toBe('string');
    expect(jti).toMatch(/^rcpt_resp-001_/);

    // Verify the JWT with the public key from getPublicKeyJwk
    const publicJwk = await getPublicKeyJwk();
    const publicKey = await importJWK(publicJwk, 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, { algorithms: ['ES256'] });

    expect(payload.sub).toBe('npi-1234567890');
    expect(payload.jti).toBe(jti);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');

    const vcv = payload.vcv as Record<string, unknown>;
    expect(vcv.claimId).toBe('claim-001');
    expect(vcv.source).toBe('State University');
    expect(vcv.status).toBe('confirmed');
    expect(vcv.observed_at).toBe('2026-01-15T10:00:00Z');
    expect(vcv.raw_hash).toBe('abc123');
    expect(vcv.provider_id).toBe('npi-1234567890');
    // No actorId passed — vcv.actor_id and azp must be absent
    expect(vcv.actor_id).toBeUndefined();
    expect((payload as Record<string, unknown>).azp).toBeUndefined();
  });

  it('embeds actorId as azp and vcv.actor_id when provided', async () => {
    const response = makeResponse();
    const { jwt } = await signIssuerReceipt(response, {
      providerId: 'npi-1234567890',
      claimId: 'claim-001',
      source: 'State University',
      rawHash: 'abc123',
      actorId: 'user_clerk_abc123',
    });

    const publicJwk = await getPublicKeyJwk();
    const publicKey = await importJWK(publicJwk, 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, { algorithms: ['ES256'] });

    // sub still = NPI (subject = provider identity)
    expect(payload.sub).toBe('npi-1234567890');
    // azp = Clerk userId (RFC 9068 authorized party)
    expect((payload as Record<string, unknown>).azp).toBe('user_clerk_abc123');
    // vcv.actor_id = same Clerk userId for replay lineage
    const vcv = payload.vcv as Record<string, unknown>;
    expect(vcv.actor_id).toBe('user_clerk_abc123');
    expect(vcv.provider_id).toBe('npi-1234567890');
  });

  it('omits azp and actor_id when actorId is null', async () => {
    const response = makeResponse();
    const { jwt } = await signIssuerReceipt(response, {
      providerId: 'npi-111',
      claimId: 'claim-002',
      source: 'Test Org',
      rawHash: 'deadbeef',
      actorId: null,
    });

    const publicJwk = await getPublicKeyJwk();
    const publicKey = await importJWK(publicJwk, 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, { algorithms: ['ES256'] });

    expect((payload as Record<string, unknown>).azp).toBeUndefined();
    const vcv = payload.vcv as Record<string, unknown>;
    expect(vcv.actor_id).toBeUndefined();
  });

  it('sets exp roughly 90 days after iat', async () => {
    const response = makeResponse();
    const { jwt } = await signIssuerReceipt(response, {
      providerId: 'npi-111',
      claimId: 'claim-002',
      source: 'Test Org',
      rawHash: 'deadbeef',
    });

    const publicJwk = await getPublicKeyJwk();
    const publicKey = await importJWK(publicJwk, 'ES256');
    const { payload } = await jwtVerify(jwt, publicKey, { algorithms: ['ES256'] });

    const durationDays = ((payload.exp ?? 0) - (payload.iat ?? 0)) / 86400;
    expect(durationDays).toBeCloseTo(90, 0);
  });
});

describe('buildAndSignReceiptCandidate', () => {
  it('attaches signedReceiptJwt only when status is confirmed', async () => {
    const request = makeRequest();
    const confirmedResponse = makeResponse('confirmed');

    const candidate = await buildAndSignReceiptCandidate(request, confirmedResponse, {
      receiptCandidateId: 'rc-001',
      claimId: 'claim-001',
      providerId: 'npi-1234567890',
      source: 'State University',
      rawHash: 'sha256-abc',
      actorId: 'user_clerk_test456',
    });

    expect(candidate.signedReceiptJwt).toBeDefined();
    expect(typeof candidate.signedReceiptJwt).toBe('string');
    // JWT must have 3 parts
    expect(candidate.signedReceiptJwt!.split('.').length).toBe(3);
    // Truth contract invariants must hold
    expect(candidate.decisionGrade).toBe(false);
    expect(candidate.proofTier).toBe('receipt_candidate');

    // Actor attribution must be embedded in the signed JWT
    const publicJwk = await getPublicKeyJwk();
    const publicKey = await importJWK(publicJwk, 'ES256');
    const { payload } = await jwtVerify(candidate.signedReceiptJwt!, publicKey, { algorithms: ['ES256'] });
    expect((payload as Record<string, unknown>).azp).toBe('user_clerk_test456');
    const vcv = payload.vcv as Record<string, unknown>;
    expect(vcv.actor_id).toBe('user_clerk_test456');
    expect(vcv.provider_id).toBe('npi-1234567890');
  });

  it('does NOT attach signedReceiptJwt for non-confirmed statuses', async () => {
    const request = makeRequest();

    for (const status of ['unable_to_verify', 'wrong_office', 'legally_only', 'requires_release'] as const) {
      const response = makeResponse(status);
      const candidate = await buildAndSignReceiptCandidate(request, response, {
        receiptCandidateId: `rc-${status}`,
        claimId: 'claim-001',
        providerId: 'npi-111',
        source: 'Test Org',
        rawHash: 'no-hash',
      });
      expect(candidate.signedReceiptJwt).toBeUndefined();
    }
  });
});
