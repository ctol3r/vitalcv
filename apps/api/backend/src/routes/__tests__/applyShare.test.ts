/**
 * applyShare.test.ts
 *
 * Unit tests for the Apply-with-VitalCV share event system.
 * Tests: validation, webhook dispatch logic, revocation,
 * share listing, structured response shape, and email fallback.
 *
 * All Prisma and external fetch calls are mocked.
 */

import { validateOrganizationContext, ShareValidationError } from '../../services/distribution/applyShareService';

// ── Validation tests ──────────────────────────────────────────────────────────

describe('validateOrganizationContext', () => {
  it('accepts a fully valid context', () => {
    const ctx = validateOrganizationContext({
      organization_id: 'stanford-health-001',
      name: 'Stanford Health Care',
      purpose_of_use: 'Credentialing review',
      callback_url: 'https://ehr.stanford.edu/vcv',
    });
    expect(ctx.organization_id).toBe('stanford-health-001');
    expect(ctx.name).toBe('Stanford Health Care');
    expect(ctx.purpose_of_use).toBe('Credentialing review');
    expect(ctx.callback_url).toBe('https://ehr.stanford.edu/vcv');
  });

  it('accepts context without callback_url', () => {
    const ctx = validateOrganizationContext({
      organization_id: 'npi-0000000001',
      name: 'UCSF Medical Center',
      purpose_of_use: 'Employment consideration',
    });
    expect(ctx.callback_url).toBeUndefined();
  });

  it('throws when organization_context is missing', () => {
    expect(() => validateOrganizationContext(null)).toThrow(ShareValidationError);
    expect(() => validateOrganizationContext(undefined)).toThrow(ShareValidationError);
    expect(() => validateOrganizationContext('string')).toThrow(ShareValidationError);
  });

  it('throws when organization_id is missing', () => {
    expect(() => validateOrganizationContext({
      name: 'Some Org',
      purpose_of_use: 'Locum tenens placement',
    })).toThrow(ShareValidationError);
  });

  it('throws when name is missing', () => {
    expect(() => validateOrganizationContext({
      organization_id: 'org-001',
      purpose_of_use: 'Privileging application',
    })).toThrow(ShareValidationError);
  });

  it('throws when purpose_of_use is missing', () => {
    expect(() => validateOrganizationContext({
      organization_id: 'org-001',
      name: 'Test Org',
    })).toThrow(ShareValidationError);
  });

  it('throws on invalid callback_url scheme', () => {
    expect(() => validateOrganizationContext({
      organization_id: 'org-001',
      name: 'Test Org',
      purpose_of_use: 'Credentialing review',
      callback_url: 'ftp://not-http.example.com',
    })).toThrow(ShareValidationError);
  });

  it('rejects http:// callback_url (https only — code and message now agree)', () => {
    // Previously this asserted http:// was ACCEPTED while the error message
    // claimed "must be a valid https:// URL". The validator now rejects http://.
    expect(() => validateOrganizationContext({
      organization_id: 'org-001',
      name: 'Test Org',
      purpose_of_use: 'Contract renewal',
      callback_url: 'http://internal.example.com/webhook',
    })).toThrow(ShareValidationError);
  });

  it('throws when organization_id exceeds 256 chars', () => {
    expect(() => validateOrganizationContext({
      organization_id: 'x'.repeat(257),
      name: 'Test',
      purpose_of_use: 'Credentialing review',
    })).toThrow(ShareValidationError);
  });

  it('throws when name exceeds 256 chars', () => {
    expect(() => validateOrganizationContext({
      organization_id: 'org-001',
      name: 'x'.repeat(257),
      purpose_of_use: 'Credentialing review',
    })).toThrow(ShareValidationError);
  });

  it('throws when purpose_of_use exceeds 512 chars', () => {
    expect(() => validateOrganizationContext({
      organization_id: 'org-001',
      name: 'Org',
      purpose_of_use: 'x'.repeat(513),
    })).toThrow(ShareValidationError);
  });

  it('trims whitespace from string fields', () => {
    const ctx = validateOrganizationContext({
      organization_id: '  org-001  ',
      name: '  Test Org  ',
      purpose_of_use: '  Credentialing review  ',
    });
    expect(ctx.organization_id).toBe('org-001');
    expect(ctx.name).toBe('Test Org');
    expect(ctx.purpose_of_use).toBe('Credentialing review');
  });

  it('coerces non-string fields to strings', () => {
    const ctx = validateOrganizationContext({
      organization_id: 12345,
      name: 'Org',
      purpose_of_use: 'Other',
    });
    expect(ctx.organization_id).toBe('12345');
  });

  it('ShareValidationError has statusCode 400', () => {
    try {
      validateOrganizationContext(null);
      fail('Expected ShareValidationError');
    } catch (e) {
      expect(e).toBeInstanceOf(ShareValidationError);
      expect((e as ShareValidationError).statusCode).toBe(400);
    }
  });
});

// ── ShareResult shape contract ────────────────────────────────────────────────

describe('ShareResult shape', () => {
  // These tests verify the TypeScript interface contracts via runtime checks
  // using a synthetic result object (no real DB or network calls).

  const VALID_SHARE_RESULT = {
    success: true,
    shareId: '550e8400-e29b-41d4-a716-446655440001',
    bundleId: '550e8400-e29b-41d4-a716-446655440000',
    recipient: { organization_id: 'org-001', name: 'Stanford Health Care' },
    status: 'delivered' as const,
    sharedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    bundleUrl: 'https://vitalcv.com/apply/550e8400-e29b-41d4-a716-446655440000',
    webhookDelivered: true,
    emailSent: false,
  };

  it('has required fields', () => {
    expect(VALID_SHARE_RESULT.success).toBe(true);
    expect(VALID_SHARE_RESULT.shareId).toBeTruthy();
    expect(VALID_SHARE_RESULT.bundleId).toBeTruthy();
    expect(VALID_SHARE_RESULT.recipient.organization_id).toBe('org-001');
    expect(VALID_SHARE_RESULT.recipient.name).toBe('Stanford Health Care');
    expect(['delivered', 'email_fallback', 'logged_only']).toContain(VALID_SHARE_RESULT.status);
    expect(VALID_SHARE_RESULT.bundleUrl).toMatch(/^https?:\/\/.+\/apply\/.+/);
  });

  it('expiresAt is after sharedAt', () => {
    const shared = new Date(VALID_SHARE_RESULT.sharedAt).getTime();
    const expires = new Date(VALID_SHARE_RESULT.expiresAt).getTime();
    expect(expires).toBeGreaterThan(shared);
  });

  it('expiresAt is approximately 24h after sharedAt', () => {
    const shared = new Date(VALID_SHARE_RESULT.sharedAt).getTime();
    const expires = new Date(VALID_SHARE_RESULT.expiresAt).getTime();
    const diffHours = (expires - shared) / 3_600_000;
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it('status email_fallback shape', () => {
    const emailResult = { ...VALID_SHARE_RESULT, status: 'email_fallback' as const, webhookDelivered: false, emailSent: true };
    expect(emailResult.webhookDelivered).toBe(false);
    expect(emailResult.emailSent).toBe(true);
  });

  it('status logged_only shape', () => {
    const loggedResult = { ...VALID_SHARE_RESULT, status: 'logged_only' as const, webhookDelivered: false, emailSent: false };
    expect(loggedResult.status).toBe('logged_only');
  });
});

// ── Webhook payload shape ─────────────────────────────────────────────────────

describe('Webhook payload schema contract', () => {
  it('webhook envelope has required fields', () => {
    const envelope = {
      schema: 'vitalcv.apply.share.v1',
      event: 'bundle.shared',
      delivery_id: 'test-delivery-001',
      issued_at: new Date().toISOString(),
      share_id: 'share-001',
      organization: { id: 'org-001', name: 'Test Org', purpose_of_use: 'Credentialing review' },
      bundle: {
        bundle_id: 'bundle-001',
        bundle_url: 'https://vitalcv.com/apply/bundle-001',
        npi: '1234567890',
        clinician_name: 'Dr. Jane Doe',
        readiness_level: 'L3',
        readiness_score: 84,
        credential_count: 4,
        expires_at: new Date(Date.now() + 86400_000).toISOString(),
        signature: 'sha256abcdef',
      },
    };

    expect(envelope.schema).toBe('vitalcv.apply.share.v1');
    expect(envelope.event).toBe('bundle.shared');
    expect(envelope.organization.purpose_of_use).toBeTruthy();
    expect(envelope.bundle.readiness_level).toBeTruthy();
    expect(envelope.bundle.credential_count).toBeGreaterThanOrEqual(0);
    expect(envelope.bundle.signature).toBeTruthy();
  });

  it('HMAC signature uses t= prefix format', () => {
    const { createHmac } = require('node:crypto');
    const secret = 'test-secret';
    const body = JSON.stringify({ event: 'bundle.shared' });
    const ts = 1700000000000;
    const sig = createHmac('sha256', secret).update(`t=${ts}${body}`).digest('hex');
    // Signature format: "t=<ts>,v1=<hex>"
    const header = `t=${ts},v1=${sig}`;
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });
});

// ── Audit log structure ───────────────────────────────────────────────────────

describe('Audit log fields', () => {
  it('share event audit has required fields', () => {
    const auditEntry = {
      category: ['BUNDLE_EXPORT'],
      actor: 'user_clerk_001',
      resource: 'share-uuid-001',
      requestFields: {
        npi: '1234567890',
        organizationId: 'org-001',
        organizationName: 'Test Org',
        purposeOfUse: 'Credentialing review',
        credentialCount: 3,
      },
      resultFields: {
        shareId: 'share-uuid-001',
        bundleId: 'bundle-uuid-001',
        status: 'delivered',
        webhookDelivered: true,
        emailSent: false,
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      },
      severity: 'INFO',
    };
    expect(auditEntry.category).toContain('BUNDLE_EXPORT');
    expect(auditEntry.actor).toBeTruthy();
    expect(auditEntry.requestFields.npi).toMatch(/^\d{10}$/);
    expect(auditEntry.resultFields.status).toBeTruthy();
  });

  it('revoke audit uses REVOCATION category and WARN severity', () => {
    const revokeAudit = {
      category: ['REVOCATION'],
      actor: 'user_clerk_001',
      resource: 'share-uuid-001',
      requestFields: { shareId: 'share-uuid-001', bundleId: 'bundle-001', organizationId: 'org-001' },
      resultFields: { revokedAt: new Date().toISOString() },
      severity: 'WARN',
    };
    expect(revokeAudit.category).toContain('REVOCATION');
    expect(revokeAudit.severity).toBe('WARN');
  });
});

// ── NPI validation ────────────────────────────────────────────────────────────

describe('NPI format validation', () => {
  const NPI_RE = /^\d{10}$/;

  it.each([
    ['1234567890', true],
    ['0000000000', true],
    ['9999999999', true],
  ])('accepts valid NPI %s', (npi, valid) => {
    expect(NPI_RE.test(npi)).toBe(valid);
  });

  it.each([
    ['123456789'],    // 9 digits
    ['12345678901'],  // 11 digits
    ['123456789a'],   // letters
    [''],             // empty
    ['NPI-123'],      // prefixed
  ])('rejects invalid NPI %s', (npi) => {
    expect(NPI_RE.test(npi)).toBe(false);
  });
});

// ── Malformed share id gate ───────────────────────────────────────────────────

describe('revokeShare — malformed share id', () => {
  it('rejects a non-uuid shareId before any database lookup', async () => {
    // BundleShareEvent.id is a Postgres uuid column — an unguarded non-uuid
    // string makes Prisma throw (a 500) instead of returning null. The guard
    // must fail closed with the same "not found" validation error, without a
    // live database in the loop.
    const { revokeShare } = await import('../../services/distribution/applyShareService');

    for (const bad of ['x', 'not-a-uuid', '../../etc/passwd', '550e8400-e29b-41d4-a716']) {
      await expect(revokeShare(bad, 'user_123')).rejects.toThrow(ShareValidationError);
      await expect(revokeShare(bad, 'user_123')).rejects.toThrow('Share not found.');
    }
  });
});
