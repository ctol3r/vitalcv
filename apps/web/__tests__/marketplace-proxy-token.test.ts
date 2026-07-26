import { describe, it, expect, vi, beforeEach } from 'vitest';

// Enforce-flip prerequisite: buildMarketplaceHeaders backs ~17 marketplace
// proxies. It must forward BOTH x-clerk-user-id AND a verified Authorization
// bearer, or every one of those routes 401s under the backend's
// verifiedIdentity=enforce mode. It also preserves the role/email headers the
// backend's tenant + org-role guards read. See forward-identity.test.ts.

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

type Session = Awaited<ReturnType<typeof import('@clerk/nextjs/server').auth>>;

function session(overrides: Record<string, unknown>): Session {
  return { getToken: async () => 'jwt-mp', ...overrides } as unknown as Session;
}

beforeEach(() => authMock.mockReset());

describe('buildMarketplaceHeaders — enforce readiness', () => {
  it('forwards x-clerk-user-id AND Authorization bearer for a signed-in session', async () => {
    // applyIdentityHeaders resolves the token via auth() when not pre-passed.
    authMock.mockResolvedValue(session({ userId: 'user_1' }));
    const headers = await buildMarketplaceHeaders(session({ userId: 'user_1' }));
    expect(headers.get('x-clerk-user-id')).toBe('user_1');
    expect(headers.get('authorization')).toBe('Bearer jwt-mp');
  });

  it('still forwards the backend role + email headers alongside the token', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_1' }));
    const headers = await buildMarketplaceHeaders(
      session({
        userId: 'user_1',
        sessionClaims: { email: 'dr@example.com', role: 'super-admin', org_role: 'org:admin' },
      }),
    );
    expect(headers.get('x-clerk-user-email')).toBe('dr@example.com');
    expect(headers.get('x-user-role')).toBe('super-admin');
    expect(headers.get('x-org-role')).toBe('org:admin');
    expect(headers.get('authorization')).toBe('Bearer jwt-mp');
  });

  it('preserves caller-supplied init headers', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_1' }));
    const headers = await buildMarketplaceHeaders(session({ userId: 'user_1' }), {
      'Content-Type': 'application/json',
    });
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
  });

  it('falls back to id-only when the session cannot mint a token (behavior-preserving in off/shadow)', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_1', getToken: undefined }));
    const headers = await buildMarketplaceHeaders(session({ userId: 'user_1', getToken: undefined }));
    expect(headers.get('x-clerk-user-id')).toBe('user_1');
    expect(headers.get('authorization')).toBeNull();
  });

  it('sets no identity headers for an anonymous session', async () => {
    authMock.mockResolvedValue(session({ userId: null }));
    const headers = await buildMarketplaceHeaders(session({ userId: null }));
    expect(headers.get('x-clerk-user-id')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
  });
});
