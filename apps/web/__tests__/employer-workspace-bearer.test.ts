/**
 * Enforce-flip prerequisite for the employer workspace path.
 *
 * `lib/server/employer-workspace.ts` forwards `x-clerk-user-id` on every
 * backend call. The backend's verified-identity middleware 401s an identity
 * header that arrives WITHOUT a matching verified bearer once
 * `CLERK_JWT_VERIFICATION=enforce`. Before this suite, the module set the
 * identity header and no Authorization header at all — so the live route
 * `app/api/request-review/route.ts` would have 401'd the moment enforce
 * flipped. See docs/security/enforce-readiness-2026-08-07.md.
 *
 * These assert the headers that actually leave the process, via a captured
 * fetch, rather than the internals that build them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

import {
  resolveEmployerWorkspaceAuthContext,
  buildEmployerWorkspaceHeaders,
} from '@/lib/server/employer-workspace';

type Session = Awaited<ReturnType<typeof import('@clerk/nextjs/server').auth>>;

function session(overrides: Record<string, unknown>): Session {
  return { getToken: async () => 'jwt-employer', ...overrides } as unknown as Session;
}

const WORKSPACE = {
  activePersona: 'EMPLOYER',
  activeOrgId: 'org-1',
  memberships: [
    { active: true, role: 'ADMIN', org: { organizationId: 'org-1', npi: '1234567893', npiType: 'TYPE_2' } },
  ],
};

let captured: Headers | null = null;

beforeEach(() => {
  authMock.mockReset();
  captured = null;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    captured = new Headers(init?.headers as HeadersInit);
    return new Response(JSON.stringify(WORKSPACE), { status: 200 });
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('employer workspace lookup — enforce readiness', () => {
  it('sends Authorization bearer alongside x-clerk-user-id to the backend', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_emp' }));

    await resolveEmployerWorkspaceAuthContext();

    expect(captured).not.toBeNull();
    expect(captured!.get('x-clerk-user-id')).toBe('user_emp');
    // The assertion that fails without the fix.
    expect(captured!.get('authorization')).toBe('Bearer jwt-employer');
  });

  it('carries the token onto the ready context so downstream calls can pair it', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_emp' }));

    const ctx = await resolveEmployerWorkspaceAuthContext();
    expect(ctx.status).toBe('ready');
    if (ctx.status !== 'ready') return;
    expect(ctx.token).toBe('jwt-employer');
  });

  it('pairs the bearer on every downstream employer request header', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_emp' }));

    const ctx = await resolveEmployerWorkspaceAuthContext();
    if (ctx.status !== 'ready') throw new Error('expected ready context');

    const headers = buildEmployerWorkspaceHeaders(ctx);
    expect(headers.get('x-clerk-user-id')).toBe('user_emp');
    expect(headers.get('authorization')).toBe('Bearer jwt-employer');
    expect(headers.get('x-org-id')).toBe('org-1');
  });

  it('never emits an identity header silently — a null token is warned about', async () => {
    authMock.mockResolvedValue(session({ userId: 'user_emp', getToken: async () => null }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = await resolveEmployerWorkspaceAuthContext();
    if (ctx.status !== 'ready') throw new Error('expected ready context');
    buildEmployerWorkspaceHeaders(ctx);

    // A session that cannot mint a token WILL 401 under enforce. It must be
    // observable rather than silent, so the flip decision can be measured.
    const warned = warn.mock.calls.some((c) => String(c[0]).includes('identity_header_without_bearer'));
    expect(warned).toBe(true);
    warn.mockRestore();
  });
});
