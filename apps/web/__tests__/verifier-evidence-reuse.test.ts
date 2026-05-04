import { describe, expect, it } from 'vitest';
import { classifyConstraintViolation } from '@/lib/issuer-verification/receiptCandidate';
import { checkCrossTenantReuseBlock } from '@/lib/issuer-verification/psvReceiptReuse';

// ---------------------------------------------------------------------------
// VERIFIER-EVIDENCE-1: classifyConstraintViolation
// ---------------------------------------------------------------------------

describe('classifyConstraintViolation', () => {
  it('returns tamper_detected for Postgres 23514 (CHECK constraint violation)', () => {
    const pgError = { code: '23514', message: 'new row violates check constraint' };
    expect(classifyConstraintViolation(pgError)).toBe('tamper_detected');
  });

  it('returns unknown_error for non-database errors', () => {
    expect(classifyConstraintViolation(new Error('network error'))).toBe('unknown_error');
  });
});

// ---------------------------------------------------------------------------
// VERIFIER-REUSE-1: checkCrossTenantReuseBlock
// ---------------------------------------------------------------------------

describe('checkCrossTenantReuseBlock', () => {
  it('blocks reuse across tenants when no consent receipt is provided', () => {
    const result = checkCrossTenantReuseBlock('tenant-org-b', 'tenant-org-a');
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('cross_tenant_no_consent');
    }
  });

  it('permits reuse across tenants only when explicit consent receipt is present', () => {
    const result = checkCrossTenantReuseBlock(
      'tenant-org-b',
      'tenant-org-a',
      'consent-receipt-xyz-789',
    );
    expect(result.blocked).toBe(false);
  });
});
