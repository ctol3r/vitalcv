import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadRequestReviewRoute() {
  return import(new URL('../app/api/request-review/route.ts', import.meta.url).href);
}

function buildWorkspaceResponse(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    activePersona: 'VERIFIER',
    activeOrgId: 'org-1',
    personProfile: null,
    memberships: [
      {
        org: {
          id: 'org-profile-1',
          organizationId: 'org-1',
          npi: '1999999999',
          npiType: 'TYPE_2',
          orgDid: null,
          facilityType: 'hospital',
          specialties: [],
          statesCovered: ['CA'],
          website: 'https://mercy.example',
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        },
        role: 'ADMIN',
        active: true,
      },
    ],
    canSwitchTo: ['VERIFIER'],
    ...overrides,
  };
}

describe('/api/request-review route contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects invalid clinician NPI before touching workspace or entity resolution', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'employer@example.com' },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadRequestReviewRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/request-review', {
      method: 'POST',
      body: JSON.stringify({ npi: '123' }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'npi must be a 10-digit number.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the caller is signed in but has no employer workspace', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'employer@example.com' },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({
        activePersona: 'CLINICIAN',
        activeOrgId: null,
        memberships: [],
        canSwitchTo: ['CLINICIAN'],
      })));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadRequestReviewRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/request-review', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890' }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/me/workspaces',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(init.headers.get('x-clerk-user-email')).toBe('employer@example.com');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'EMPLOYER_WORKSPACE_REQUIRED',
      error: 'Employer workspace required to request a review.',
      hint: 'Create or switch into an employer workspace before requesting a clinician review.',
      nextStep: 'create_workspace',
    });
  });

  it('returns 404 when the clinician does not yet have a reviewable passport', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'employer@example.com' },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(jsonResponse({
        entity: {
          id: 'employer-entity-1',
          displayName: 'Mercy General',
          npiType: 'TYPE_2',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: 'Passport not found.',
      }, 404));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadRequestReviewRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/request-review', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890' }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'CLINICIAN_PASSPORT_REQUIRED',
      error: 'No passport found for that NPI. The clinician must run a readiness check first.',
      hint: 'Ask the clinician to run a readiness check before creating an employer review context.',
      nextStep: 'run_clinician_readiness',
    });
  });

  it('creates review context with the active employer workspace VcvEntity, not the Clerk user id', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'employer@example.com' },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(jsonResponse({
        entity: {
          id: 'employer-entity-1',
          displayName: 'Mercy General',
          npiType: 'TYPE_2',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        entityId: 'clinician-entity-1',
        identity: {
          displayName: 'Ada Lovelace, MD',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        context: {
          id: 'ctx-1',
          status: 'PENDING',
        },
      }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadRequestReviewRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/request-review', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890' }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://backend.test/api/entity/resolve/npi/1999999999',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://backend.test/api/passport/npi/1234567890',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://backend.test/api/organization-context',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );

    const [, init] = fetchMock.mock.calls[3] as [string, { body: string; headers: Headers }];
    expect(init.headers.get('Content-Type')).toBe('application/json');
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(init.headers.get('x-clerk-user-email')).toBe('employer@example.com');
    expect(init.headers.get('x-org-id')).toBe('org-1');
    expect(JSON.parse(init.body)).toEqual({
      requestorEntityId: 'employer-entity-1',
      contextType: 'EMPLOYMENT_REVIEW',
      title: 'Employment review — NPI 1234567890',
      description: 'Employer-initiated review for clinician NPI 1234567890.',
      subjectEntityIds: ['clinician-entity-1'],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contextId: 'ctx-1',
      entityId: 'clinician-entity-1',
      status: 'PENDING',
      reviewUrl: 'http://localhost/review/clinician-entity-1?contextId=ctx-1',
      npi: '1234567890',
      displayName: 'Ada Lovelace, MD',
    });
  });
});
