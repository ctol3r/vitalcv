import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildMonitoringSubscription,
  CollectingWatchtowerNotifier,
  FileWatchtowerEventStore,
  InMemoryWatchtowerEventStore,
  WatchtowerMonitorEngine,
  type WatchtowerClaim,
  type WatchtowerClaimsProvider,
} from '../watchtowerCore';

class SequenceClaimsProvider implements WatchtowerClaimsProvider {
  private readonly queueBySubject = new Map<string, WatchtowerClaim[][]>();

  seed(subjectId: string, responses: WatchtowerClaim[][]): void {
    this.queueBySubject.set(subjectId, responses.map((claims) => [...claims]));
  }

  async fetchClaims(subscription: { subjectId: string }): Promise<readonly WatchtowerClaim[]> {
    const queue = this.queueBySubject.get(subscription.subjectId) ?? [];
    return queue.shift() ?? [];
  }
}

describe('watchtower core', () => {
  it('builds configurable subscriptions and determines when checks are due', () => {
    const subscription = buildMonitoringSubscription({
      subjectId: '1234567890',
      checkIntervalMinutes: 30,
      claimTypes: ['LICENSE'],
      alertSeverityFloor: 'HIGH',
      triggers: [
        {
          channel: 'EMAIL',
          destination: 'ops@vitalcv.com',
          severityAtLeast: 'HIGH',
          cooldownMinutes: 15,
        },
      ],
    }, '2026-03-14T00:00:00.000Z');

    expect(subscription.nextCheckAt).toBe('2026-03-14T00:00:00.000Z');
    expect(subscription.claimTypes).toEqual(['LICENSE']);
    expect(subscription.triggers).toEqual([
      expect.objectContaining({
        channel: 'EMAIL',
        destination: 'ops@vitalcv.com',
        severityAtLeast: 'HIGH',
        cooldownMinutes: 15,
      }),
    ]);
  });

  it('detects claim changes, emits alerts, stores history, and triggers notifications', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const claimsProvider = new SequenceClaimsProvider();
    const notifier = new CollectingWatchtowerNotifier();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
      claimsProvider,
      notifier,
    });

    claimsProvider.seed('1234567890', [
      [
        {
          claimId: 'license-ca',
          claimType: 'LICENSE',
          status: 'ACTIVE',
          value: { licenseNumber: 'CA-123', state: 'CA', status: 'ACTIVE' },
        },
      ],
      [
        {
          claimId: 'license-ca',
          claimType: 'LICENSE',
          status: 'REVOKED',
          value: { licenseNumber: 'CA-123', state: 'CA', status: 'REVOKED' },
        },
      ],
    ]);

    const subscription = await engine.createSubscription({
      subjectId: '1234567890',
      checkIntervalMinutes: 60,
      claimTypes: ['LICENSE'],
      alertSeverityFloor: 'HIGH',
      triggers: [
        {
          channel: 'WEBHOOK',
          destination: 'https://ops.vitalcv.example/watchtower',
          severityAtLeast: 'HIGH',
        },
      ],
    }, '2026-03-14T00:00:00.000Z');

    const initialRun = await engine.runDueChecks('2026-03-14T00:00:00.000Z');
    expect(initialRun).toHaveLength(1);
    expect(initialRun[0]?.deltas).toHaveLength(0);
    expect(initialRun[0]?.alerts).toHaveLength(0);

    const changedRun = await engine.runDueChecks('2026-03-14T01:00:00.000Z');
    expect(changedRun).toHaveLength(1);
    expect(changedRun[0]?.deltas).toEqual([
      expect.objectContaining({
        kind: 'CLAIM_CHANGED',
        claimType: 'LICENSE',
      }),
      expect.objectContaining({
        kind: 'CLAIM_STATUS_CHANGED',
        claimType: 'LICENSE',
        currentStatus: 'REVOKED',
      }),
    ]);
    expect(changedRun[0]?.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimType: 'LICENSE',
          severity: 'CRITICAL',
        }),
      ]),
    );
    expect(changedRun[0]?.notifications).toHaveLength(2);
    expect(notifier.deliveries).toHaveLength(2);

    const events = await eventStore.listEvents({ subjectId: '1234567890' });
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'CHECK_COMPLETED',
      'CLAIM_CHANGE_DETECTED',
      'ALERT_EMITTED',
      'NOTIFICATION_TRIGGERED',
    ]));

    const storedSnapshot = await eventStore.getLatestSnapshot('1234567890');
    expect(storedSnapshot?.claims).toEqual([
      expect.objectContaining({
        claimId: 'license-ca',
        status: 'REVOKED',
      }),
    ]);

    const storedSubscription = await eventStore.getSubscription(subscription.subscriptionId);
    expect(storedSubscription?.lastCheckedAt).toBe('2026-03-14T01:00:00.000Z');
    expect(storedSubscription?.nextCheckAt).toBe('2026-03-14T02:00:00.000Z');
  });

  it('filters monitoring by subscription configuration', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
      notifier: new CollectingWatchtowerNotifier(),
    });

    const subscription = await engine.createSubscription({
      subjectId: '9999999999',
      checkIntervalMinutes: 15,
      claimTypes: ['LICENSE'],
      alertSeverityFloor: 'HIGH',
      triggers: [
        {
          channel: 'SLACK',
          destination: '#trust-ops',
          severityAtLeast: 'HIGH',
        },
      ],
    }, '2026-03-14T05:00:00.000Z');

    await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T05:00:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone' },
        },
      ],
    });

    const result = await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T05:15:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone-Wells' },
        },
      ],
    });

    expect(result.deltas).toHaveLength(0);
    expect(result.alerts).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  it('persists event history and subscriptions through the file-backed store', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watchtower-store-'));
    const filePath = path.join(tempDir, 'history.json');

    try {
      const store = new FileWatchtowerEventStore(filePath);
      const subscription = buildMonitoringSubscription({
        subscriptionId: 'watchsub_file',
        subjectId: '5555555555',
        checkIntervalMinutes: 60,
      }, '2026-03-14T09:00:00.000Z');

      await store.saveSubscription(subscription);
      await store.appendEvents([
        {
          eventId: 'event_file_1',
          type: 'CHECK_COMPLETED',
          subjectId: '5555555555',
          subscriptionId: 'watchsub_file',
          occurredAt: '2026-03-14T09:00:00.000Z',
          payload: { deltaCount: 0, alertCount: 0, notificationCount: 0 },
        },
      ]);

      const reloadedStore = new FileWatchtowerEventStore(filePath);
      expect(await reloadedStore.getSubscription('watchsub_file')).toEqual(
        expect.objectContaining({
          subjectId: '5555555555',
          subscriptionId: 'watchsub_file',
        }),
      );
      expect(await reloadedStore.listEvents({ subjectId: '5555555555' })).toEqual([
        expect.objectContaining({
          type: 'CHECK_COMPLETED',
        }),
      ]);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
