import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const slackMock = vi.fn();
vi.mock('@/lib/pilot-intake/slack', () => ({
  deliverPilotIntakeToSlack: (...args: unknown[]) => slackMock(...args),
  isSlackConfigured: () => false,
}));

import { POST } from '@/app/api/pilot-intake/route';

const validBody = {
  fullName: 'Macie Miller',
  email: 'macie@example-cvo.com',
  organization: 'Example CVO',
  persona: 'cvo',
  description: 'We credential 200 clinicians/quarter and want a pilot.',
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/pilot-intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  slackMock.mockReset();
});

afterEach(() => {
  slackMock.mockReset();
});

describe('POST /api/pilot-intake', () => {
  it('returns 400 invalid_json when body is not JSON', async () => {
    const res = await POST(makeRequest('not json'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: 'invalid_json' });
    expect(slackMock).not.toHaveBeenCalled();
  });

  it('returns 400 with field errors when validation fails', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'no-at' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors.email).toBeTruthy();
    expect(slackMock).not.toHaveBeenCalled();
  });

  it('returns 200 with slackDelivered:true when slack succeeds', async () => {
    slackMock.mockResolvedValueOnce({ delivered: true });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, slackDelivered: true, slackReason: null });
    expect(slackMock).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with slackDelivered:false + reason when slack fails', async () => {
    slackMock.mockResolvedValueOnce({ delivered: false, reason: 'http_error' });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, slackDelivered: false, slackReason: 'http_error' });
  });

  it('still returns 200 even when SLACK env is unconfigured (intake is logged-only)', async () => {
    slackMock.mockResolvedValueOnce({ delivered: false, reason: 'unconfigured' });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      slackDelivered: false,
      slackReason: 'unconfigured',
    });
  });
});
