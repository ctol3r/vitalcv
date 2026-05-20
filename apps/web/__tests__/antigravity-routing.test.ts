import { describe, expect, it } from 'vitest';

import {
  evaluateAntigravityRoute,
  ANTIGRAVITY_COOKIE_ACTIVE_RECEIPT,
  ANTIGRAVITY_COOKIE_RECEIPT_STATUS,
} from '@/lib/auth/antigravity';

describe('antigravity · role gating', () => {
  it('non-verifier roles always pass (antigravity is verifier-scoped)', () => {
    for (const role of [
      'CLINICIAN',
      'ISSUER',
      'ADMIN',
      'AUTHENTICATED',
      null,
    ] as const) {
      const d = evaluateAntigravityRoute({
        role,
        pathname: '/dashboard',
        activeReceiptId: 'rcpt_7a2c',
        receiptStatus: 'ACTIVE',
      });
      expect(d.action).toBe('pass');
    }
  });
});

describe('antigravity · explicit denylist', () => {
  it('redirects verifiers off /dashboard back to active receipt', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/dashboard',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('redirect');
    expect(d.redirectTo).toBe('/verify/receipt/rcpt_7a2c');
    expect(d.reason).toBe('verifier_blocked_route');
  });

  it('redirects verifiers off /home', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/home',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('redirect');
  });

  it('redirects verifiers off nested /dashboard/* and /home/*', () => {
    for (const p of ['/dashboard/clinicians', '/home/recents']) {
      const d = evaluateAntigravityRoute({
        role: 'VERIFIER',
        pathname: p,
        activeReceiptId: 'rcpt_7a2c',
        receiptStatus: 'ACTIVE',
      });
      expect(d.action).toBe('redirect');
    }
  });

  it('passes for verifier without an active receipt (no redirect target)', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/dashboard',
      activeReceiptId: null,
      receiptStatus: null,
    });
    expect(d.action).toBe('pass');
  });
});

describe('antigravity · canonical verifier paths', () => {
  it('passes for the active receipt URL itself', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/verify/receipt/rcpt_7a2c',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('pass');
  });

  it('passes for /verify root', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/verify',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('pass');
  });

  it('passes for /verify/guide', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/verify/guide',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('pass');
  });

  it('passes for any other /verify/receipt/<id> subpath', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/verify/receipt/another',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('pass');
  });
});

describe('antigravity · terminal status locks to read-only receipt view', () => {
  it.each(['ACCEPTED', 'REVOKED'] as const)(
    '%s receipt: any non-canonical path redirects to the receipt view',
    (status) => {
      const d = evaluateAntigravityRoute({
        role: 'VERIFIER',
        pathname: '/verify',
        activeReceiptId: 'rcpt_7a2c',
        receiptStatus: status,
      });
      expect(d.action).toBe('redirect');
      expect(d.redirectTo).toBe('/verify/receipt/rcpt_7a2c');
      expect(d.reason).toBe('receipt_terminal_status_locked_to_read_only');
    },
  );

  it('passes when already on the active receipt URL with ACCEPTED status', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/verify/receipt/rcpt_7a2c',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACCEPTED',
    });
    expect(d.action).toBe('pass');
  });
});

describe('antigravity · cookie name surface', () => {
  it('cookie keys are stable institutional identifiers', () => {
    expect(ANTIGRAVITY_COOKIE_ACTIVE_RECEIPT).toBe('vcv_active_receipt');
    expect(ANTIGRAVITY_COOKIE_RECEIPT_STATUS).toBe(
      'vcv_active_receipt_status',
    );
  });
});

describe('antigravity · off-canonical paths trigger redirect even outside denylist', () => {
  it('verifier on /intelligence with active receipt → redirect home', () => {
    const d = evaluateAntigravityRoute({
      role: 'VERIFIER',
      pathname: '/intelligence/snapshot',
      activeReceiptId: 'rcpt_7a2c',
      receiptStatus: 'ACTIVE',
    });
    expect(d.action).toBe('redirect');
    expect(d.reason).toBe('verifier_off_canonical_path');
  });
});
