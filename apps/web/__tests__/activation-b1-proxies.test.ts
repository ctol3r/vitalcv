/**
 * The clinician-profile web proxies — Wave 1076 B1.
 *
 * These routes are the boundary between a browser and a durable professional
 * record, so what they REFUSE matters more than what they forward:
 *
 *   - no Clerk session → 401 here, without the backend being called at all;
 *   - identity forwarded from the verified session, never from the request;
 *   - the claim body reduced to an NPI, so a browser cannot hand the server a
 *     payload and have it stored as a registry answer;
 *   - upstream statuses preserved, because 404 / 422 / 401 / 503 are four
 *     different sentences to a clinician and only one of them is a fault.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const identityMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/auth/forwardIdentity', () => ({
  buildIdentityHeaders: (...args: unknown[]) => identityMock(...args),
}));

const NPI = '1003000126';
const VIEW = { npi: NPI, state: 'resolved', fields: [], missingRequired: [] };

let fetchMock: ReturnType<typeof vi.fn>;

function upstream(status: number, body: unknown) {
  fetchMock.mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response);
}

/** The single upstream call these routes made, if any. */
function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
  return { url, init };
}

beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  authMock.mockResolvedValue({ userId: 'user_clinician' });
  identityMock.mockResolvedValue({
    'x-clerk-user-id': 'user_clinician',
    Authorization: 'Bearer verified.jwt',
  });
  upstream(200, VIEW);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const params = (npi: string) => ({ params: Promise.resolve({ npi }) });

async function claimRoute() {
  return (await import('../app/api/clinician-profile/claim/route')).POST;
}

describe('a signed-out browser never reaches the profile service', () => {
  beforeEach(() => authMock.mockResolvedValue({ userId: null }));

  it('answers 401 for a claim, without calling upstream', async () => {
    const POST = await claimRoute();
    const res = await POST(new Request('http://x/api/clinician-profile/claim', {
      method: 'POST', body: JSON.stringify({ npi: NPI }),
    }) as never);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 401 for a read, a correction, and a save', async () => {
    const read = (await import('../app/api/clinician-profile/[npi]/route')).GET;
    const patch = (await import('../app/api/clinician-profile/[npi]/route')).PATCH;
    const save = (await import('../app/api/clinician-profile/[npi]/save/route')).POST;

    const reqBody = { method: 'PATCH', body: JSON.stringify({ corrections: {} }) };
    const results = await Promise.all([
      read(new Request('http://x') as never, params(NPI) as never),
      patch(new Request('http://x', reqBody) as never, params(NPI) as never),
      save(new Request('http://x', { method: 'POST' }) as never, params(NPI) as never),
    ]);

    for (const res of results) expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the claim sends an NPI and nothing else', () => {
  it('drops a browser-authored snapshot rather than forwarding it', async () => {
    const POST = await claimRoute();
    await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({
        npi: NPI,
        // The exact attack the server-authoritative claim exists to defeat:
        // edit the preview in devtools, claim, and have your own text carry a
        // registry label for the life of the profile.
        resolved: { fullName: 'MADE UP' },
        resolvedSnapshot: { specialty: 'Neurosurgery' },
        savedAt: '2020-01-01',
      }),
    }) as never);

    expect(JSON.parse(lastCall().init.body as string)).toEqual({ npi: NPI });
  });

  it('refuses a malformed NPI at the edge', async () => {
    const POST = await claimRoute();
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ npi: '12345' }),
    }) as never);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a non-string NPI rather than coercing it into a URL', async () => {
    const POST = await claimRoute();
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ npi: { toString: 'nope' } }),
    }) as never);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('identity comes from the verified session', () => {
  it('forwards the bearer and the id minted from the session', async () => {
    const POST = await claimRoute();
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ npi: NPI }) }) as never);

    const headers = lastCall().init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer verified.jwt');
    expect(headers['x-clerk-user-id']).toBe('user_clinician');
    // Minted from the resolved session, not read off the incoming request.
    expect(identityMock).toHaveBeenCalledWith({ userId: 'user_clinician' });
  });

  it('ignores an identity header the browser tried to set', async () => {
    const POST = await claimRoute();
    await POST(new Request('http://x', {
      method: 'POST',
      headers: { 'x-clerk-user-id': 'user_someone_else' },
      body: JSON.stringify({ npi: NPI }),
    }) as never);

    expect((lastCall().init.headers as Record<string, string>)['x-clerk-user-id']).toBe('user_clinician');
  });
});

describe('corrections', () => {
  it('forwards only the corrections object', async () => {
    const { PATCH } = await import('../app/api/clinician-profile/[npi]/route');
    await PATCH(new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ corrections: { specialty: 'Urgent Care' }, savedAt: 'now', activatedAt: 'now' }),
    }) as never, params(NPI) as never);

    expect(JSON.parse(lastCall().init.body as string)).toEqual({
      corrections: { specialty: 'Urgent Care' },
    });
  });

  it('sends an empty object when corrections are not an object', async () => {
    const { PATCH } = await import('../app/api/clinician-profile/[npi]/route');
    await PATCH(new Request('http://x', {
      method: 'PATCH', body: JSON.stringify({ corrections: ['specialty'] }),
    }) as never, params(NPI) as never);

    expect(JSON.parse(lastCall().init.body as string)).toEqual({ corrections: {} });
  });

  it('relays a field-level refusal intact, so the surface can place it', async () => {
    upstream(400, { error: { code: 'FIELD_INVALID', message: 'Enter a valid email address.', field: 'contactEmail' } });
    const { PATCH } = await import('../app/api/clinician-profile/[npi]/route');

    const res = await PATCH(new Request('http://x', {
      method: 'PATCH', body: JSON.stringify({ corrections: { contactEmail: 'nope' } }),
    }) as never, params(NPI) as never);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: 'FIELD_INVALID', message: 'Enter a valid email address.', field: 'contactEmail' },
    });
  });
});

describe('there is no activate proxy, because there is no activate endpoint', () => {
  it('the save route asks the backend to SAVE', async () => {
    const { POST } = await import('../app/api/clinician-profile/[npi]/save/route');
    await POST(new Request('http://x', { method: 'POST' }) as never, params(NPI) as never);

    expect(lastCall().url).toContain(`/api/clinician-profile/${NPI}/save`);
    expect(lastCall().url).not.toContain('activate');
  });

  it('relays 422 and its message when the profile is incomplete', async () => {
    upstream(422, { error: { code: 'PROFILE_INCOMPLETE', message: 'Add contactEmail before saving a reusable profile.' } });
    const { POST } = await import('../app/api/clinician-profile/[npi]/save/route');

    const res = await POST(new Request('http://x', { method: 'POST' }) as never, params(NPI) as never);

    expect(res.status).toBe(422);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('the recovery list', () => {
  it('asks for saved profiles by default', async () => {
    const { GET } = await import('../app/api/clinician-profile/route');
    await GET({ nextUrl: { searchParams: new URLSearchParams() } } as never);

    expect(lastCall().url).toMatch(/\/api\/clinician-profile$/);
  });

  it('asks for drafts too when the surface needs to recover one', async () => {
    const { GET } = await import('../app/api/clinician-profile/route');
    await GET({ nextUrl: { searchParams: new URLSearchParams('include=all') } } as never);

    expect(lastCall().url).toContain('/api/clinician-profile?include=all');
  });
});

describe('failure modes are told apart', () => {
  it('answers 503 and states that nothing changed when the service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const POST = await claimRoute();

    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ npi: NPI }) }) as never);

    expect(res.status).toBe(503);
    // A network fault must not be reported as a finding about the clinician.
    expect((await res.json() as { error: string }).error).toContain('Nothing was changed');
  });

  it('preserves a 404 rather than flattening it into an error', async () => {
    upstream(404, { error: { code: 'NOT_FOUND', message: 'No profile draft for that NPI.' } });
    const { GET } = await import('../app/api/clinician-profile/[npi]/route');

    const res = await GET(new Request('http://x') as never, params(NPI) as never);
    expect(res.status).toBe(404);
  });

  it('never lets a shared cache hold one clinician’s draft', async () => {
    const { GET } = await import('../app/api/clinician-profile/[npi]/route');
    const res = await GET(new Request('http://x') as never, params(NPI) as never);

    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
