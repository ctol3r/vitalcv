const createMock = jest.fn();
const findManyMock = jest.fn();
const findUniqueMock = jest.fn();
const findFirstMock = jest.fn();
const updateMock = jest.fn();
const upsertMock = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    integrationWebhookSubscription: {
      create: createMock,
      findMany: findManyMock,
      findUnique: findUniqueMock,
      findFirst: findFirstMock,
      update: updateMock,
    },
    outboxEvent: {
      upsert: upsertMock,
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  createIntegrationWebhookSubscription,
  deliverIntegrationWebhook,
  enqueueIntegrationWebhookEvent,
  parseIntegrationWebhookOutboxPayload,
} from '../webhookSystem';

describe('webhookSystem', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    createMock.mockReset();
    findManyMock.mockReset();
    findUniqueMock.mockReset();
    findFirstMock.mockReset();
    updateMock.mockReset();
    upsertMock.mockReset();
    fetchMock.mockReset();
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as typeof fetch;
  });

  it('creates a subscription with normalized supported events', async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      id: 'sub-1',
      organizationId: 'org-1',
      url: 'https://example.test/hook',
      events: ['manifest.generated', 'drift.detected'],
      active: true,
      failureCount: 0,
      lastDeliveredAt: null,
      lastFailureAt: null,
      createdAt: new Date('2026-04-14T12:00:00.000Z'),
    });

    const result = await createIntegrationWebhookSubscription({
      url: 'https://example.test/hook',
      organizationId: 'org-1',
      events: ['manifest.generated', 'drift.detected'],
      signingSecret: 'top-secret',
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        url: 'https://example.test/hook',
        signingSecret: 'top-secret',
        events: ['manifest.generated', 'drift.detected'],
      },
      select: expect.any(Object),
    });
    expect(result.subscription.events).toEqual(['manifest.generated', 'drift.detected']);
    expect(result.signingSecret).toBe('top-secret');
  });

  it('enqueues one outbox row per matching subscription', async () => {
    findManyMock.mockResolvedValue([
      { id: 'sub-1', organizationId: 'org-1' },
      { id: 'sub-2', organizationId: null },
    ]);
    upsertMock.mockResolvedValue({ id: 'outbox-1' });

    const queued = await enqueueIntegrationWebhookEvent({
      eventType: 'employer.accepted',
      subjectNpi: '1234567890',
      manifestId: 'bundle-1',
      timestamp: '2026-04-14T12:00:00.000Z',
      organizationId: 'org-1',
      dedupeKey: 'audit-1',
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        active: true,
        events: { has: 'employer.accepted' },
        OR: [
          { organizationId: 'org-1' },
          { organizationId: null },
        ],
      },
      select: {
        id: true,
        organizationId: true,
      },
    });
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(queued).toBe(2);
  });

  it('delivers the exact payload body with a VitalCV signature header', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'sub-1',
      url: 'https://example.test/hook',
      signingSecret: 'secret-1',
      active: true,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
    });

    const payload = parseIntegrationWebhookOutboxPayload({
      subscriptionId: 'sub-1',
      organizationId: 'org-1',
      delivery: {
        eventType: 'manifest.generated',
        subjectNpi: '1234567890',
        manifestId: 'manifest-1',
        timestamp: '2026-04-14T12:00:00.000Z',
      },
    });

    await deliverIntegrationWebhook(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-VitalCV-Event': 'manifest.generated',
          'X-VitalCV-Signature': expect.stringMatching(/^sha256=/),
          'X-VitalCV-Timestamp': '2026-04-14T12:00:00.000Z',
        }),
        body: JSON.stringify({
          eventType: 'manifest.generated',
          subjectNpi: '1234567890',
          manifestId: 'manifest-1',
          timestamp: '2026-04-14T12:00:00.000Z',
        }),
        signal: expect.any(Object),
      }),
    );
  });
});
