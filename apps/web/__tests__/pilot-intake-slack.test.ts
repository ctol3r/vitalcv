import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { deliverPilotIntakeToSlack, isSlackConfigured } from '@/lib/pilot-intake/slack';
import type { PilotIntakeInput } from '@/lib/pilot-intake/validate';

const intake: PilotIntakeInput = {
  fullName: 'Macie Miller',
  email: 'macie@example-cvo.com',
  organization: 'Example CVO',
  persona: 'cvo',
  description: 'We credential 200/quarter and want a pilot.',
};

const ORIGINAL = process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL;
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL === undefined) delete process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL;
  else process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL = ORIGINAL;
});

describe('deliverPilotIntakeToSlack', () => {
  it('returns unconfigured when no webhook url is set', async () => {
    delete process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL;
    const result = await deliverPilotIntakeToSlack(intake);
    expect(result).toEqual({ delivered: false, reason: 'unconfigured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns delivered:true on a 2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await deliverPilotIntakeToSlack(intake, 'https://hooks.slack.com/test');
    expect(result).toEqual({ delivered: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns http_error on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await deliverPilotIntakeToSlack(intake, 'https://hooks.slack.com/test');
    expect(result).toEqual({ delivered: false, reason: 'http_error' });
  });

  it('returns fetch_failed when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const result = await deliverPilotIntakeToSlack(intake, 'https://hooks.slack.com/test');
    expect(result).toEqual({ delivered: false, reason: 'fetch_failed' });
  });

  it('isSlackConfigured reports env state', () => {
    delete process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL;
    expect(isSlackConfigured()).toBe(false);
    process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL = 'https://hooks.slack.com/test';
    expect(isSlackConfigured()).toBe(true);
  });
});
