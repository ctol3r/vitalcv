/**
 * POST /api/profile/student/bootstrap — web proxy contract.
 *
 * The no-NPI preview lane's proxy must:
 *   - 401 (no backend call) when signed out.
 *   - When signed in, forward the request to the backend student-bootstrap
 *     route with the verified Clerk identity (never a caller-supplied id) and
 *     pass the backend status/body straight back.
 */
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/auth/forwardIdentity', () => ({
  applyIdentityHeaders: async (headers: Headers, input: { userId: string }) => {
    headers.set('x-clerk-user-id', input.userId);
  },
}));

import { POST as studentBootstrapPOST } from '@/app/api/profile/student/bootstrap/route';

function makeReq(body: unknown): NextRequest {
  return new Request('http://localhost/api/profile/student/bootstrap', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/profile/student/bootstrap proxy', () => {
  const realFetch = global.fetch;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('401s when signed out and never calls the backend', async () => {
    authMock.mockResolvedValue({ userId: null });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const res = await studentBootstrapPOST(makeReq({ attested: true }));

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards to the backend with the verified Clerk identity and mirrors the result', async () => {
    authMock.mockResolvedValue({
      userId: 'user_test',
      sessionClaims: { email: 'student@med.school.edu' },
    });
    const backendBody = { profession: 'student', previewOnly: true, completeness: 10 };
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(backendBody), { status: 201 }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const res = await studentBootstrapPOST(makeReq({ attested: true, attestationVersion: 'v1' }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(backendBody);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/profile\/student\/bootstrap$/);
    expect(init.method).toBe('POST');
    const headers = init.headers as Headers;
    // Identity is the server-verified Clerk id, plus the email claim for
    // first-touch User resolution (ensureWorkspaceUser). No caller-supplied id.
    expect(headers.get('x-clerk-user-id')).toBe('user_test');
    expect(headers.get('x-clerk-user-email')).toBe('student@med.school.edu');
  });
});
