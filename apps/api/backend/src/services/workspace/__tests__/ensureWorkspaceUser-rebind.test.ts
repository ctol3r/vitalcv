// Guards the account-takeover fix in ensureWorkspaceUser. Email-based
// reconciliation may bind an existing row onto an incoming Clerk id ONLY when
// that row is a platform-minted placeholder — an explicit allowlist. Real Clerk
// accounts, seed rows, and any legacy/unknown row must be refused so a
// caller-supplied `x-clerk-user-email` header cannot hijack an established
// account. Pure-function test — no DB required.
import { isReconcilablePlaceholderId } from '../workspaceService';

describe('isReconcilablePlaceholderId', () => {
  it('allows only the platform-minted marketplace-availability placeholder', () => {
    expect(isReconcilablePlaceholderId('marketplace-availability:1234567890')).toBe(true);
  });

  it('refuses real Clerk accounts', () => {
    expect(isReconcilablePlaceholderId('user_2abcXYZ')).toBe(false);
    expect(isReconcilablePlaceholderId('user_')).toBe(false);
  });

  it('refuses seed rows and legacy/unknown ids (not an exclusion allowlist)', () => {
    expect(isReconcilablePlaceholderId('seed-clerk-1234567890')).toBe(false);
    expect(isReconcilablePlaceholderId('__trust_state_unbound__:1234567890')).toBe(false);
    expect(isReconcilablePlaceholderId('legacy-id-42')).toBe(false);
    expect(isReconcilablePlaceholderId('system')).toBe(false);
    expect(isReconcilablePlaceholderId('')).toBe(false);
  });

  it('is prefix-anchored (a spoofed substring does not match)', () => {
    expect(isReconcilablePlaceholderId('x-marketplace-availability:1')).toBe(false);
    expect(isReconcilablePlaceholderId('user_marketplace-availability:1')).toBe(false);
    // The bare prefix without the `:` namespace separator must not match.
    expect(isReconcilablePlaceholderId('marketplace-availability')).toBe(false);
  });
});
