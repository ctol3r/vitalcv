/**
 * GET/POST /api/clinician/notifications — the clinician's own contact
 * settings. Pins that the subject is server-derived, that consent writes are
 * strict, and that "deliverable" never overstates what VitalCV can do.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const subjectMock = vi.hoisted(() => vi.fn());
const grantMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());
const readConsentsMock = vi.hoisted(() => vi.fn());
const readPrefMock = vi.hoisted(() => vi.fn());
const updatePrefMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/clinician-notifications/subject', () => ({
  resolveNotificationSubject: subjectMock,
}));
vi.mock('@/lib/clinician-notifications/consent-store', () => ({
  grantContactConsent: grantMock,
  revokeContactConsent: revokeMock,
  readContactConsentStates: readConsentsMock,
}));
vi.mock('@/lib/clinician-notifications/preferences', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clinician-notifications/preferences')>(
    '@/lib/clinician-notifications/preferences',
  );
  return {
    ...actual,
    readNotificationPreference: readPrefMock,
    updateNotificationPreference: updatePrefMock,
  };
});

const NPI = '1234567893';
const NOW = '2026-08-08T00:00:00.000Z';

async function loadRoute() {
  return import(new URL('../app/api/clinician/notifications/route.ts', import.meta.url).href);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/clinician/notifications', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  [authMock, subjectMock, grantMock, revokeMock, readConsentsMock, readPrefMock, updatePrefMock].forEach(
    (m) => m.mockReset(),
  );
  authMock.mockResolvedValue({ userId: 'user_n1' });
  subjectMock.mockResolvedValue({
    ok: true,
    subject: { npi: NPI, hasVerifiedEmail: true, verifiedEmailDomain: 'example.org' },
  });
  grantMock.mockResolvedValue({ persisted: true, eventRef: 'evt-1', changed: true, seq: 1 });
  revokeMock.mockResolvedValue({ persisted: true, eventRef: 'evt-2', changed: true, seq: 2 });
  readConsentsMock.mockResolvedValue([
    { channel: 'EMAIL', granted: true, eventRef: 'evt-1', seq: 1, at: NOW },
  ]);
  readPrefMock.mockResolvedValue({
    channels: ['EMAIL'],
    severityFloor: 'HIGH',
    suppressionWindowMinutes: 1440,
    active: true,
    isDefault: true,
  });
  updatePrefMock.mockResolvedValue({ persisted: true, preference: {} });
});

describe('auth and subject derivation', () => {
  it('requires a session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { GET, POST } = await loadRoute();
    expect((await GET()).status).toBe(401);
    expect((await POST(post({ decision: 'grant' }))).status).toBe(401);
  });

  it('refuses a client-supplied NPI — the subject is derived, never sent', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', npi: '9999999999' }));
    expect(response.status).toBe(400);
    expect((await response.json()).rejectedFields).toContain('npi');
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('explains rather than 500s when no NPI is bound to the account', async () => {
    subjectMock.mockResolvedValue({ ok: false, reason: 'no_npi_on_profile' });
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant' }));
    expect(response.status).toBe(409);
    expect((await response.json()).refusal).toBe('no_npi_on_profile');
  });

  it('answers 503 when canonical profile state is unreadable', async () => {
    subjectMock.mockResolvedValue({ ok: false, reason: 'unavailable' });
    const { GET } = await loadRoute();
    expect((await GET()).status).toBe(503);
  });
});

describe('consent', () => {
  it('grants for the derived NPI and records the capture source', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ changed: true, eventRef: 'evt-1', seq: 1 });
    expect(grantMock).toHaveBeenCalledWith({
      clinicianNpi: NPI,
      channel: 'EMAIL',
      grantSource: 'holder_settings',
    });
  });

  it('revokes', async () => {
    readConsentsMock.mockResolvedValue([
      { channel: 'EMAIL', granted: false, eventRef: 'evt-2', seq: 2, at: NOW },
    ]);
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'revoke' }));
    expect(response.status).toBe(200);
    expect((await response.json()).deliverable).toBe(false);
    expect(revokeMock).toHaveBeenCalled();
  });

  it('answers 503 when the ledger write does not persist — never a phantom grant', async () => {
    grantMock.mockResolvedValue({ persisted: false, eventRef: null, changed: false, seq: null });
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'grant' }))).status).toBe(503);
  });

  it('rejects an unknown decision and an empty body', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'maybe' }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
  });
});

describe('deliverability honesty', () => {
  it('is false when consent is granted but no verified address exists', async () => {
    // Consent is permission, not an address. Saying "deliverable" here would
    // promise mail that can never arrive.
    subjectMock.mockResolvedValue({
      ok: true,
      subject: { npi: NPI, hasVerifiedEmail: false, verifiedEmailDomain: null },
    });
    const { GET } = await loadRoute();
    const body = await (await GET()).json();
    expect(body.consents[0].granted).toBe(true);
    expect(body.hasVerifiedEmail).toBe(false);
    expect(body.deliverable).toBe(false);
  });

  it('is true only with both consent and an address', async () => {
    const { GET } = await loadRoute();
    expect((await (await GET()).json()).deliverable).toBe(true);
  });
});

describe('preferences', () => {
  it('validates the severity floor and window type', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ severityFloor: 'URGENT' }))).status).toBe(400);
    expect((await POST(post({ suppressionWindowMinutes: 'soon' }))).status).toBe(400);
    expect((await POST(post({ active: 'yes' }))).status).toBe(400);
    expect(updatePrefMock).not.toHaveBeenCalled();
  });

  it('accepts a preference update without a consent decision', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ severityFloor: 'CRITICAL', suppressionWindowMinutes: 4320 }));
    expect(response.status).toBe(200);
    expect(updatePrefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianNpi: NPI,
        severityFloor: 'CRITICAL',
        suppressionWindowMinutes: 4320,
      }),
    );
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('answers 503 when preferences cannot be saved', async () => {
    updatePrefMock.mockResolvedValue({ persisted: false, preference: {} });
    const { POST } = await loadRoute();
    expect((await POST(post({ active: false }))).status).toBe(503);
  });
});
