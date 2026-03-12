import { describe, expect, it } from 'vitest';

import webhookDisciplineFixture from '../fixtures/nursys.webhook.discipline.json';
import { NursysENotifyAdapter } from '../adapters/NursysENotifyAdapter';
import { InMemoryMonitoringSubscriptionState } from '../core/MonitoringSubscription';
import { projectBatchForDisclosure } from '../policies/DisclosurePolicy';
import { getSourcePolicy } from '../policies/SourcePolicy';

function getSubscriptionId(batch: Awaited<ReturnType<NursysENotifyAdapter['enrollMonitoring']>>) {
  const subscription = batch.facts.find(
    (entry) => entry.fact.factType === 'MonitoringSubscription',
  )?.fact;

  if (!subscription || subscription.factType !== 'MonitoringSubscription') {
    throw new Error('missing monitoring subscription fact');
  }

  return subscription.subscriptionId;
}

describe('DisclosurePolicy', () => {
  it('enforces minimum disclosure for verifier audiences', async () => {
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState: new InMemoryMonitoringSubscriptionState(),
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

    const projected = projectBatchForDisclosure(
      batch,
      getSourcePolicy('nursys-enotify'),
      {
        audience: 'VERIFIER',
      },
    );

    const license = projected.facts.find((entry) => entry.fact.factType === 'License')?.fact;
    expect(license?.factType).toBe('License');
    if (license?.factType === 'License') {
      expect('licenseNumber' in license).toBe(false);
      expect(license.licenseNumberLast4).toBe('7654');
      expect(license.status).toBe('ACTIVE');
    }

    const provenance = projected.facts.find(
      (entry) => entry.fact.factType === 'SourceProvenance',
    )?.provenance;
    expect(provenance?.raw_response_hash).toBeTruthy();
  });

  it('fails closed for disallowed disclosure audiences', async () => {
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState: new InMemoryMonitoringSubscriptionState(),
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

    expect(() =>
      projectBatchForDisclosure(batch, getSourcePolicy('nursys-enotify'), {
        audience: 'CLINICIAN',
      }),
    ).toThrow(/not permitted/);
  });
});
