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

async function loadEmployerSetupRoute() {
  return import(new URL('../app/api/employer/setup/route.ts', import.meta.url).href);
}

describe('/api/employer/setup route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects an invalid org NPI before proxying to the backend', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadEmployerSetupRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/employer/setup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Mercy General', npi: '123' }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Organization NPI must be exactly 10 digits.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the existing employer setup payload while normalizing name and NPI', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ organizationId: 'org-1' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadEmployerSetupRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/employer/setup', {
      method: 'POST',
      body: JSON.stringify({
        name: '  Mercy General  ',
        npi: '  1999999999  ',
        facilityType: 'hospital',
        specialties: ['Emergency Medicine'],
        statesCovered: ['CA'],
        tagline: 'Ready for launch.',
        description: 'Pilot employer profile.',
        website: 'https://mercy.example',
        hiringTypes: ['perm'],
        pilotMode: true,
        organizationAcceptanceRules: {
          acceptL3CredentialsAutomatically: true,
        },
        trustAcceptanceContracts: {
          triggerDecisionCapsuleOnHire: false,
        },
        automationRules: {
          enabled: true,
          minReadinessScore: 80,
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer/setup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-clerk-user-id': 'clerk-user-1',
        }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      name: 'Mercy General',
      npi: '1999999999',
      facilityType: 'hospital',
      specialties: ['Emergency Medicine'],
      statesCovered: ['CA'],
      tagline: 'Ready for launch.',
      description: 'Pilot employer profile.',
      website: 'https://mercy.example',
      hiringTypes: ['perm'],
      pilotMode: true,
      organizationAcceptanceRules: {
        acceptL3CredentialsAutomatically: true,
      },
      trustAcceptanceContracts: {
        triggerDecisionCapsuleOnHire: false,
      },
      automationRules: {
        enabled: true,
        minReadinessScore: 80,
      },
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ organizationId: 'org-1' });
  });
});
