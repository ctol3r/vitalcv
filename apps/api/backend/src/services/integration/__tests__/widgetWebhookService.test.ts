import { createHmac } from 'node:crypto';

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { emitWidgetEvent } from '../widgetWebhookService';

const fetchMock = jest.fn();

describe('widgetWebhookService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('signs the widget event payload with HMAC-SHA256', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
    });

    const result = await emitWidgetEvent(
      'passport.verified',
      { submission_id: 'sub-1', status: 'GREEN' },
      'https://example.test/webhooks/widget',
      'widget-secret',
    );

    expect(result).toEqual({ delivered: true, status: 202 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = init.body as string;

    expect(headers['X-VitalCV-Event']).toBe('passport.verified');
    expect(headers['X-VitalCV-Signature']).toBe(
      `sha256=${createHmac('sha256', 'widget-secret').update(body).digest('hex')}`,
    );
    expect(JSON.parse(body)).toEqual(
      expect.objectContaining({
        event: 'passport.verified',
        payload: {
          submission_id: 'sub-1',
          status: 'GREEN',
        },
      }),
    );
  });

  it('returns delivered false on network errors', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const result = await emitWidgetEvent(
      'candidate.shared',
      { submission_id: 'sub-2' },
      'https://example.test/webhooks/widget',
      'widget-secret',
    );

    expect(result).toEqual({ delivered: false });
  });
});
