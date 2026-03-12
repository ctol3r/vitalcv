import { describe, expect, it } from 'vitest';

import pollFixture from '../fixtures/nursys.poll.active.json';
import webhookDisciplineFixture from '../fixtures/nursys.webhook.discipline.json';
import { createJsonHttpTransport } from '../core/AdapterInterface';
import { InMemoryMonitoringSubscriptionState } from '../core/MonitoringSubscription';
import { NursysENotifyAdapter } from '../adapters/NursysENotifyAdapter';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
    }),
    text: async () => JSON.stringify(body),
  } as Response;
}

function getSubscriptionId(batch: Awaited<ReturnType<NursysENotifyAdapter['enrollMonitoring']>>) {
  const subscription = batch.facts.find(
    (entry) => entry.fact.factType === 'MonitoringSubscription',
  )?.fact;

  if (!subscription || subscription.factType !== 'MonitoringSubscription') {
    throw new Error('missing monitoring subscription fact');
  }

  return subscription.subscriptionId;
}

describe('NursysENotifyAdapter', () => {
  it('requires institutional enrollment configuration', async () => {
    const adapter = new NursysENotifyAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(pollFixture),
      }),
    });

    await expect(
      adapter.enrollMonitoring({
        npi: '1234567893',
        deliveryMethod: 'POLLING',
      }),
    ).rejects.toThrow(/institutionId/);
  });

  it('creates a monitoring subscription artifact during enrollment', async () => {
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(pollFixture),
      }),
    });

    const batch = await adapter.enrollMonitoring({
      npi: '1234567893',
      deliveryMethod: 'POLLING',
    });

    expect(batch.summary.status).toBe('ACTIVE');
    expect(batch.facts.map((entry) => entry.fact.factType)).toContain('MonitoringSubscription');
    expect(batch.events.map((event) => event.eventType)).toContain('MonitoringSubscriptionChanged');
  });

  it('polls Nursys and normalizes license updates into facts and events', async () => {
    const state = new InMemoryMonitoringSubscriptionState();
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState: state,
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(pollFixture),
      }),
    });

    const enrollment = await adapter.enrollMonitoring({
      npi: '1234567893',
      deliveryMethod: 'POLLING',
    });
    const subscriptionId = getSubscriptionId(enrollment);

    const batch = await adapter.pollUpdates({
      npi: '1234567893',
      subscriptionId,
    });

    const license = batch.facts.find((entry) => entry.fact.factType === 'License')?.fact;
    expect(license?.factType).toBe('License');
    if (license?.factType === 'License') {
      expect(license.status).toBe('ACTIVE');
      expect(license.licenseNumber).toBe('RN987654');
      expect(license.jurisdiction).toBe('CA');
    }

    expect(batch.summary.status).toBe('ACTIVE');
    expect(batch.events.map((event) => event.eventType)).toContain('LicenseUpdated');
  });

  it('ingests webhooks and emits discipline events', async () => {
    const state = new InMemoryMonitoringSubscriptionState();
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState: state,
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(pollFixture),
      }),
    });

    const enrollment = await adapter.enrollMonitoring({
      npi: '1234567893',
      deliveryMethod: 'WEBHOOK',
      webhookTarget: 'https://vitalcv.test/hooks/nursys',
    });
    const subscriptionId = getSubscriptionId(enrollment);

    const batch = await adapter.ingestWebhook({
      subscriptionId,
      payload: webhookDisciplineFixture,
    });

    const license = batch.facts.find((entry) => entry.fact.factType === 'License')?.fact;
    expect(license?.factType).toBe('License');
    if (license?.factType === 'License') {
      expect(license.discipline).toEqual(['Probation']);
    }
    expect(batch.events.map((event) => event.eventType)).toContain('DisciplineAdded');
  });

  it('suppresses duplicate delta events on replayed webhook payloads', async () => {
    const state = new InMemoryMonitoringSubscriptionState();
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState: state,
    });

    const enrollment = await adapter.enrollMonitoring({
      npi: '1234567893',
      deliveryMethod: 'WEBHOOK',
      webhookTarget: 'https://vitalcv.test/hooks/nursys',
    });
    const subscriptionId = getSubscriptionId(enrollment);

    const first = await adapter.ingestWebhook({
      subscriptionId,
      payload: webhookDisciplineFixture,
    });
    const second = await adapter.ingestWebhook({
      subscriptionId,
      payload: webhookDisciplineFixture,
    });

    expect(first.events.map((event) => event.eventType)).toContain('DisciplineAdded');
    expect(
      second.events.filter((event) =>
        ['LicenseUpdated', 'LicenseExpired', 'DisciplineAdded'].includes(event.eventType),
      ),
    ).toHaveLength(0);
  });

  it('maps expired licenses into LicenseExpired events', async () => {
    const state = new InMemoryMonitoringSubscriptionState();
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState: state,
    });

    const enrollment = await adapter.enrollMonitoring({
      npi: '1234567893',
      deliveryMethod: 'WEBHOOK',
      webhookTarget: 'https://vitalcv.test/hooks/nursys',
    });
    const subscriptionId = getSubscriptionId(enrollment);

    const batch = await adapter.ingestWebhook({
      subscriptionId,
      payload: {
        event: {
          id: 'evt-expired-1',
          npi: '1234567893',
          licenseNumber: 'RN987654',
          state: 'CA',
          eventType: 'LICENSE_EXPIRED',
          status: 'EXPIRED',
          expirationDate: '2026-03-01T00:00:00.000Z',
        },
      },
    });

    expect(batch.summary.status).toBe('EXPIRED');
    expect(batch.events.map((event) => event.eventType)).toContain('LicenseExpired');
  });
});
