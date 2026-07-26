import { describe, expect, it, vi } from 'vitest';
import {
  cleanupClinician,
  mintClinicianSession,
  reachRoute,
  safeErrorBody,
  warmUpClinicianSession,
  type SyntheticClinicianDeps,
} from '../lib/release-monitor/syntheticClinician';

describe('safeErrorBody', () => {
  it('keeps only code + message from a Clerk error envelope', () => {
    const out = safeErrorBody(JSON.stringify({ errors: [{ code: 'form_identifier_exists', message: 'taken', meta: {} }] }));
    expect(out).toContain('form_identifier_exists');
    expect(out).toContain('taken');
  });

  it('redacts long token-like fragments and never echoes a raw ticket/secret body', () => {
    const leaky = JSON.stringify({ errors: [{ code: 'x', message: 'ticket abcdef0123456789ABCDEFghij failed' }], ticket: 'st_supersecretvalue_0123456789' });
    const out = safeErrorBody(leaky);
    expect(out).not.toContain('supersecretvalue');
    expect(out).not.toContain('abcdef0123456789ABCDEFghij');
    expect(out).toContain('[redacted]');
  });

  it('never throws on non-JSON or empty bodies', () => {
    expect(safeErrorBody('<html>502</html>')).toBe('clerk error (unparseable body)');
    expect(safeErrorBody('{}')).toBe('clerk error (no safe fields)');
  });
});

function jsonRes(body: unknown, opts: { status?: number; setCookie?: string[] } = {}): Response {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  for (const c of opts.setCookie ?? []) headers.append('set-cookie', c);
  return new Response(JSON.stringify(body), { status: opts.status ?? 200, headers });
}

function redirectRes(location: string, status = 307): Response {
  return new Response(null, { status, headers: new Headers({ location }) });
}

const base: Omit<SyntheticClinicianDeps, 'fetchImpl'> = {
  clerkSecretKey: 'sk_test',
  appBase: 'https://vitalcv.com',
  runId: 'test1',
};

describe('mintClinicianSession', () => {
  it('runs the full Clerk + FAPI sequence in order and seeds the cookie jar', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? 'GET'} ${u.split('?')[0]}`);
      if (u.includes('/v1/users')) return jsonRes({ id: 'user_1' });
      if (u.includes('/v1/organizations')) return jsonRes({ id: 'org_1' });
      if (u.includes('/v1/sign_in_tokens')) return jsonRes({ token: 'tik_1' });
      if (u.includes('/v1/client/sign_ins')) {
        return jsonRes({ response: { created_session_id: 'sess_1', status: 'complete' }, client: {} }, { setCookie: ['__client=c1; Path=/'] });
      }
      if (u.includes('/touch')) return jsonRes({ response: {} }, { setCookie: ['__client_uat=1700; Path=/'] });
      if (u.includes('/tokens')) return jsonRes({ jwt: 'jwt_1' });
      return jsonRes({});
    });

    const r = await mintClinicianSession({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 1_700_000_000_000 });
    expect(r.ok).toBe(true);
    expect(r.session?.userId).toBe('user_1');
    expect(r.session?.orgId).toBe('org_1');
    expect(r.session?.sessionId).toBe('sess_1');
    expect(r.session?.jwt).toBe('jwt_1');
    expect(r.session?.cookies.__session).toBe('jwt_1');
    expect(r.session?.cookies.__client_uat).toBe('1700');
    expect(calls).toEqual([
      'POST https://api.clerk.com/v1/users',
      'POST https://api.clerk.com/v1/organizations',
      'POST https://api.clerk.com/v1/sign_in_tokens',
      'POST https://clerk.vitalcv.com/v1/client/sign_ins',
      'POST https://clerk.vitalcv.com/v1/client/sessions/sess_1/touch',
      'POST https://clerk.vitalcv.com/v1/client/sessions/sess_1/tokens',
    ]);
  });

  it('fails fast with a clear message when CLERK_SECRET_KEY is empty', async () => {
    const fetchImpl = vi.fn();
    const r = await mintClinicianSession({ ...base, clerkSecretKey: '', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('CLERK_SECRET_KEY');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the created ids for cleanup even when a later step fails', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/v1/users')) return jsonRes({ id: 'user_x' });
      if (u.includes('/v1/organizations')) return jsonRes({ id: 'org_x' });
      if (u.includes('/v1/sign_in_tokens')) return jsonRes({ error: 'nope' }, { status: 500 });
      return jsonRes({});
    });
    const r = await mintClinicianSession({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.created).toEqual({ userId: 'user_x', orgId: 'org_x' });
  });

  it('reports created ids INCREMENTALLY (before mint returns) so a mid-mint kill can clean up', async () => {
    const snapshots: Array<{ userId: string | null; orgId: string | null }> = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/v1/users')) return jsonRes({ id: 'user_x' });
      if (u.includes('/v1/organizations')) return jsonRes({ id: 'org_x' });
      // Hang-analogue: fail right after both resources exist.
      if (u.includes('/v1/sign_in_tokens')) return jsonRes({ errors: [{ code: 'x' }] }, { status: 500 });
      return jsonRes({});
    });
    await mintClinicianSession({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onResourceCreated: (c) => snapshots.push({ ...c }),
    });
    // The user id was reported the instant it existed — not only at return.
    expect(snapshots[0]).toEqual({ userId: 'user_x', orgId: null });
    expect(snapshots.at(-1)).toEqual({ userId: 'user_x', orgId: 'org_x' });
  });
});

describe('cleanupClinician', () => {
  it('deletes org then user', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(url)}`);
      return new Response(null, { status: 200 });
    });
    const r = await cleanupClinician({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }, { userId: 'user_1', orgId: 'org_1' });
    expect(r.ok).toBe(true);
    expect(calls).toEqual([
      'DELETE https://api.clerk.com/v1/organizations/org_1',
      'DELETE https://api.clerk.com/v1/users/user_1',
    ]);
  });

  it('is a no-op when nothing was created', async () => {
    const fetchImpl = vi.fn();
    const r = await cleanupClinician({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }, { userId: null, orgId: null });
    expect(r.attempted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

const session = {
  userId: 'user_1',
  orgId: 'org_1',
  sessionId: 'sess_1',
  jwt: 'jwt',
  clientUat: '1',
  cookies: { __session: 'jwt', __client_uat: '1' } as Record<string, string>,
  email: 'svc-monitor+test@vitalcv.com',
};

describe('warmUpClinicianSession', () => {
  const deps = (fetchImpl: unknown): SyntheticClinicianDeps => ({ ...base, fetchImpl: fetchImpl as typeof fetch });

  it('passes when cold /holder returns 200 (the #503 cookie-on-resolve shape)', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}, { setCookie: ['vitalcv_role=CLINICIAN.x.y; Path=/'] }));
    const r = await warmUpClinicianSession(deps(fetchImpl), { ...session, cookies: { ...session.cookies } });
    expect(r.ok).toBe(true);
  });

  it('detects the P0: cold /holder → /auth/error', async () => {
    const fetchImpl = vi.fn(async () => redirectRes('/auth/error'));
    const r = await warmUpClinicianSession(deps(fetchImpl), { ...session, cookies: { ...session.cookies } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('auth_error');
  });

  it('emulates the #507 interstitial: /holder → /auth/resolving → resolve-role → /holder 200', async () => {
    let holderHits = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/auth/resolve-role')) {
        return jsonRes({ role: 'CLINICIAN' }, { setCookie: ['vitalcv_role=CLINICIAN.x.y; Path=/'] });
      }
      holderHits += 1;
      return holderHits === 1 ? redirectRes('/auth/resolving?redirect_url=/holder') : jsonRes({});
    });
    const r = await warmUpClinicianSession(deps(fetchImpl), { ...session, cookies: { ...session.cookies } });
    expect(r.ok).toBe(true);
  });

  it('fails when the session resolves to the WRONG role landing (200 off /holder)', async () => {
    // e.g. role resolved as AUTHENTICATED → middleware redirects /holder → /intelligence, which 200s
    const fetchImpl = vi.fn(async (url: string | URL) =>
      String(url).includes('/intelligence') ? jsonRes({}) : redirectRes('/intelligence'),
    );
    const r = await warmUpClinicianSession(deps(fetchImpl), { ...session, cookies: { ...session.cookies } });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('wrong_destination');
  });
});

describe('reachRoute', () => {
  const deps = (fetchImpl: unknown): SyntheticClinicianDeps => ({ ...base, fetchImpl: fetchImpl as typeof fetch });

  it('200 → ok', async () => {
    const r = await reachRoute(deps(vi.fn(async () => jsonRes({}))), session, '/holder/home');
    expect(r.ok).toBe(true);
  });

  it('a redirect to /auth/error → fail', async () => {
    const r = await reachRoute(deps(vi.fn(async () => redirectRes('/auth/error'))), session, '/holder/home');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('auth_error');
  });

  it('a role-mismatch redirect that 200s elsewhere → wrong_destination fail', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) =>
      String(url).includes('/verifier') ? jsonRes({}) : redirectRes('/verifier'),
    );
    const r = await reachRoute(deps(fetchImpl), session, '/holder/home');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wrong_destination');
  });
});
