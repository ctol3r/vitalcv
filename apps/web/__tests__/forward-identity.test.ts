import { describe, it, expect, vi, beforeEach } from 'vitest';

// G1 enforce-flip prerequisite: web proxy handlers must forward BOTH
// x-clerk-user-id AND a verified Authorization bearer, so they survive the
// backend's verifiedIdentity enforce mode (which 401s header-without-token).

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

import { buildIdentityHeaders, applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

beforeEach(() => authMock.mockReset());

describe('buildIdentityHeaders', () => {
  it('forwards both the user id and a bearer token when the session mints one', async () => {
    authMock.mockResolvedValue({ userId: 'user_1', getToken: async () => 'jwt-abc' });
    const h = await buildIdentityHeaders();
    expect(h['x-clerk-user-id']).toBe('user_1');
    expect(h.Authorization).toBe('Bearer jwt-abc');
  });

  it('falls back to id-only when getToken is unavailable (behavior-preserving)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1', getToken: undefined });
    const h = await buildIdentityHeaders();
    expect(h['x-clerk-user-id']).toBe('user_1');
    expect(h.Authorization).toBeUndefined();
  });

  it('falls back to id-only when getToken throws', async () => {
    authMock.mockResolvedValue({
      userId: 'user_1',
      getToken: async () => {
        throw new Error('token minting failed');
      },
    });
    const h = await buildIdentityHeaders();
    expect(h['x-clerk-user-id']).toBe('user_1');
    expect(h.Authorization).toBeUndefined();
  });

  it('returns an empty map for an anonymous session', async () => {
    authMock.mockResolvedValue({ userId: null, getToken: async () => null });
    expect(await buildIdentityHeaders()).toEqual({});
  });

  it('uses pre-resolved inputs without calling auth() again', async () => {
    const h = await buildIdentityHeaders({ userId: 'user_9', token: 'jwt-xyz' });
    expect(authMock).not.toHaveBeenCalled();
    expect(h).toEqual({ 'x-clerk-user-id': 'user_9', Authorization: 'Bearer jwt-xyz' });
  });
});

describe('applyIdentityHeaders', () => {
  it('mutates a Headers object in place', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    await applyIdentityHeaders(headers, { userId: 'user_1', token: 'jwt-abc' });
    expect(headers.get('x-clerk-user-id')).toBe('user_1');
    expect(headers.get('authorization')).toBe('Bearer jwt-abc');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('mutates a plain record in place', async () => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    await applyIdentityHeaders(headers, { userId: 'user_1', token: 'jwt-abc' });
    expect(headers['x-clerk-user-id']).toBe('user_1');
    expect(headers.Authorization).toBe('Bearer jwt-abc');
    expect(headers.Accept).toBe('application/json');
  });
});
