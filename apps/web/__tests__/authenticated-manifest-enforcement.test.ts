import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function passportRequest(npi = '1234567890') {
  return new NextRequest(`http://localhost:3000/api/passport/${npi}/export`);
}

function trustProofRequest(npi = '1234567890') {
  return new NextRequest(`http://localhost:3000/api/trust-proof/${npi}?format=json`);
}

function params(npi = '1234567890') {
  return { params: Promise.resolve({ npi }) };
}

describe('authenticated manifest enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('denies passport export manifests before backend issuance when the actor is anonymous', async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: {} });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const route = await import('../app/api/passport/[npi]/export/route');
    const response = await route.GET(passportRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('unauthorized');
    expect(body.manifestEnforcement).toMatchObject({
      schema: 'vitalcv.authenticated-manifest.v1',
      status: 'blocked',
      blocker: 'AUTH_REQUIRED',
      clinicianNpi: '1234567890',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies passport export manifests when the signed-in actor does not own the NPI', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1', sessionClaims: {} });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'http://backend.test/api/ownership/me') {
        expect(new Headers(init?.headers).get('x-clerk-user-id')).toBe('clerk-user-1');
        return jsonResponse({ ownerships: [{ npi: '9999999999', claimedAt: '2026-05-10T10:00:00.000Z' }] });
      }
      throw new Error(`Manifest route should not call upstream export without ownership: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const route = await import('../app/api/passport/[npi]/export/route');
    const response = await route.GET(passportRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('ownership_not_verified');
    expect(body.manifestEnforcement).toMatchObject({
      status: 'blocked',
      actorId: 'clerk-user-1',
      clinicianNpi: '1234567890',
      blocker: 'OWNERSHIP_NOT_VERIFIED',
      ownershipContinuityScore: 0,
    });
  });

  it('binds passport export manifests to the authenticated owning actor and replay lineage', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1', sessionClaims: {} });
    const packet = {
      schema: 'vitalcv.employer.packet.v1',
      clinicianNpi: '1234567890',
      manifest: {
        schema: 'vitalcv.employer.packet-manifest.v1',
        clinicianNpi: '1234567890',
        exportedAt: '2026-05-11T10:00:00.000Z',
      },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url === 'http://backend.test/api/ownership/me') {
        expect(headers.get('x-clerk-user-id')).toBe('clerk-user-1');
        return jsonResponse({
          ownerships: [{
            npi: '1234567890',
            claimedAt: '2026-05-10T10:00:00.000Z',
            verificationMethod: 'CLAIMED',
            revokedAt: null,
          }],
        });
      }

      if (url === 'http://backend.test/api/passport/1234567890/export') {
        expect(headers.get('x-clerk-user-id')).toBe('clerk-user-1');
        expect(headers.get('x-vitalcv-manifest-actor')).toBe('clerk-user-1');
        expect(headers.get('x-vitalcv-owned-npi')).toBe('1234567890');
        expect(headers.get('x-vitalcv-ownership-lineage')).toContain('vitalcv.authenticated-manifest.v1|clerk-user-1|1234567890|owned');
        return jsonResponse(packet);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const route = await import('../app/api/passport/[npi]/export/route');
    const response = await route.GET(passportRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-VitalCV-Manifest-Actor')).toBe('clerk-user-1');
    expect(response.headers.get('X-VitalCV-Owned-NPI')).toBe('1234567890');
    expect(response.headers.get('X-VitalCV-Ownership-Lineage')).toContain('clerk-user-1|1234567890|owned');
    expect(body.authenticatedManifest).toMatchObject({
      schema: 'vitalcv.authenticated-manifest.v1',
      status: 'issued',
      actorId: 'clerk-user-1',
      clinicianNpi: '1234567890',
      ownershipContinuityScore: 100,
    });
    expect(body.manifest.authenticatedActor).toMatchObject({
      actorId: 'clerk-user-1',
      clinicianNpi: '1234567890',
      ownershipVerified: true,
    });
  });

  it('requires ownership before trust-proof manifest issuance', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1', sessionClaims: {} });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url === 'http://backend.test/api/ownership/me') {
        return jsonResponse({
          ownerships: [{
            npi: '1234567890',
            claimedAt: '2026-05-10T10:00:00.000Z',
            revokedAt: null,
          }],
        });
      }

      if (url === 'http://backend.test/api/trust-proof/1234567890?format=json') {
        expect(headers.get('x-vitalcv-ownership-lineage')).toContain('clerk-user-1|1234567890|owned');
        return jsonResponse({
          npi: '1234567890',
          artifactHash: 'artifact-hash-1',
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const route = await import('../app/api/trust-proof/[npi]/route');
    const response = await route.GET(trustProofRequest(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-VitalCV-Manifest-Actor')).toBe('clerk-user-1');
    expect(body.authenticatedManifest.replayAttribution.lineageKey).toContain('clerk-user-1|1234567890|owned');
  });
});

