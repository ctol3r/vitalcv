import type { Request, Response } from 'express';

jest.mock('../../services/integration/webhookSystem', () => ({
  INTEGRATION_WEBHOOK_EVENT_TYPES: [
    'manifest.generated',
    'employer.accepted',
    'drift.detected',
  ],
  createIntegrationWebhookSubscription: jest.fn(),
}));

import { createIntegrationWebhookSubscription } from '../../services/integration/webhookSystem';
import { registerWebhookRoutes } from '../webhooks';

const createIntegrationWebhookSubscriptionMock =
  createIntegrationWebhookSubscription as jest.MockedFunction<typeof createIntegrationWebhookSubscription>;

function buildPostHandler() {
  const post = jest.fn();
  const app = { post };
  registerWebhookRoutes(app as never);
  const postCall = post.mock.calls.find((call) => call[0] === '/api/webhooks');
  if (!postCall) {
    throw new Error('webhooks route was not registered');
  }

  return postCall[1] as (req: Request, res: Response) => Promise<void>;
}

function buildResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('POST /api/webhooks', () => {
  beforeEach(() => {
    process.env.MONITORING_SECRET = 'monitoring-secret';
    createIntegrationWebhookSubscriptionMock.mockReset().mockResolvedValue({
      subscription: {
        id: 'webhook-1',
        organizationId: 'org-1',
        url: 'https://example.test/webhooks/vitalcv',
        events: ['manifest.generated', 'employer.accepted'],
        active: true,
        failureCount: 0,
        lastDeliveredAt: null,
        lastFailureAt: null,
        createdAt: '2026-04-14T12:00:00.000Z',
      },
      signingSecret: 'secret-1',
    });
  });

  it('creates a signed webhook subscription for supported events', async () => {
    const handler = buildPostHandler();
    const res = buildResponse();

    await handler({
      body: {
        url: 'https://example.test/webhooks/vitalcv',
        events: ['manifest.generated', 'employer.accepted'],
      },
      get: (name: string) => {
        if (name === 'x-monitoring-secret') return 'monitoring-secret';
        if (name === 'x-organization-id') return 'org-1';
        return undefined;
      },
    } as unknown as Request, res);

    expect(createIntegrationWebhookSubscriptionMock).toHaveBeenCalledWith({
      url: 'https://example.test/webhooks/vitalcv',
      events: ['manifest.generated', 'employer.accepted'],
      signingSecret: null,
      organizationId: 'org-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      webhook: {
        id: 'webhook-1',
        organizationId: 'org-1',
        url: 'https://example.test/webhooks/vitalcv',
        events: ['manifest.generated', 'employer.accepted'],
        active: true,
        failureCount: 0,
        lastDeliveredAt: null,
        lastFailureAt: null,
        createdAt: '2026-04-14T12:00:00.000Z',
      },
      signingSecret: 'secret-1',
      supportedEvents: ['manifest.generated', 'employer.accepted', 'drift.detected'],
    });
  });

  it('rejects requests without the monitoring secret', async () => {
    const handler = buildPostHandler();
    const res = buildResponse();

    await handler({
      body: {
        url: 'https://example.test/webhooks/vitalcv',
        events: ['manifest.generated'],
      },
      get: () => undefined,
    } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden — X-Monitoring-Secret required.',
    });
    expect(createIntegrationWebhookSubscriptionMock).not.toHaveBeenCalled();
  });
});
