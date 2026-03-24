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
  type WatchtowerNotificationDispatch,
  type WatchtowerNotificationRequest,
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

class FailingWatchtowerNotifier {
  readonly attempts: WatchtowerNotificationRequest[] = [];

  async notify(notification: WatchtowerNotificationRequest): Promise<WatchtowerNotificationDispatch> {
    this.attempts.push(notification);
    return {
      status: 'FAILED',
      error: 'downstream unavailable',
    };
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

    const events = await engine.listEventHistory({ subjectId: '1234567890' });
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'CHECK_COMPLETED',
      'CLAIM_CHANGE_DETECTED',
      'ALERT_EMITTED',
      'NOTIFICATION_TRIGGERED',
    ]));

    const storedSnapshot = await eventStore.getLatestSnapshot(subscription.subscriptionId, subscription.subjectId);
    expect(storedSnapshot).toEqual(
      expect.objectContaining({
        subscriptionId: subscription.subscriptionId,
        subjectId: '1234567890',
      }),
    );
    expect(storedSnapshot?.claims).toEqual([
      expect.objectContaining({
        claimId: 'license-ca',
        status: 'REVOKED',
      }),
    ]);

    const storedSubscription = await engine.getSubscription(subscription.subscriptionId);
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

  it('can emit initial claim-added deltas when explicitly enabled', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
      includeAddedClaimsOnInitialCheck: true,
    });

    const subscription = await engine.createSubscription({
      subjectId: '2222222222',
      claimTypes: ['LICENSE'],
    }, '2026-03-14T06:00:00.000Z');

    const result = await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T06:00:00.000Z',
      claims: [
        {
          claimId: 'license-ny',
          claimType: 'LICENSE',
          status: 'ACTIVE',
          value: { licenseNumber: 'NY-999', state: 'NY', status: 'ACTIVE' },
        },
      ],
    });

    expect(result.deltas).toEqual([
      expect.objectContaining({
        kind: 'CLAIM_ADDED',
        claimType: 'LICENSE',
      }),
    ]);
  });

  it('isolates snapshots for separate subscriptions on the same subject', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
    });

    const firstSubscription = await engine.createSubscription({
      subjectId: '7777777777',
      claimTypes: ['LICENSE'],
    }, '2026-03-14T07:00:00.000Z');
    const secondSubscription = await engine.createSubscription({
      subjectId: '7777777777',
      claimTypes: ['SANCTION'],
    }, '2026-03-14T07:00:00.000Z');

    await engine.runCheck({
      subscriptionId: firstSubscription.subscriptionId,
      checkedAt: '2026-03-14T07:00:00.000Z',
      claims: [
        {
          claimId: 'license-ca',
          claimType: 'LICENSE',
          status: 'ACTIVE',
          value: { licenseNumber: 'CA-123', state: 'CA', status: 'ACTIVE' },
        },
      ],
    });

    await engine.runCheck({
      subscriptionId: secondSubscription.subscriptionId,
      checkedAt: '2026-03-14T07:05:00.000Z',
      claims: [
        {
          claimId: 'sanction-oig',
          claimType: 'SANCTION',
          status: 'ACTIVE',
          value: { source: 'OIG', status: 'ACTIVE' },
        },
      ],
    });

    const repeatedResult = await engine.runCheck({
      subscriptionId: firstSubscription.subscriptionId,
      checkedAt: '2026-03-14T07:10:00.000Z',
      claims: [
        {
          claimId: 'license-ca',
          claimType: 'LICENSE',
          status: 'ACTIVE',
          value: { licenseNumber: 'CA-123', state: 'CA', status: 'ACTIVE' },
        },
      ],
    });

    expect(repeatedResult.deltas).toHaveLength(0);
    expect(await eventStore.getLatestSnapshot(firstSubscription.subscriptionId, firstSubscription.subjectId)).toEqual(
      expect.objectContaining({
        subscriptionId: firstSubscription.subscriptionId,
        subjectId: '7777777777',
      }),
    );
    expect(await eventStore.getLatestSnapshot(secondSubscription.subscriptionId, secondSubscription.subjectId)).toEqual(
      expect.objectContaining({
        subscriptionId: secondSubscription.subscriptionId,
        subjectId: '7777777777',
      }),
    );
  });

  it('applies the alert severity floor without suppressing delta history', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const notifier = new CollectingWatchtowerNotifier();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
      notifier,
    });

    const subscription = await engine.createSubscription({
      subjectId: '3333333333',
      claimTypes: ['PERSONAL_IDENTITY'],
      alertSeverityFloor: 'HIGH',
      triggers: [
        {
          channel: 'EMAIL',
          destination: 'ops@vitalcv.com',
          severityAtLeast: 'LOW',
        },
      ],
    }, '2026-03-14T08:00:00.000Z');

    await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T08:00:00.000Z',
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
      checkedAt: '2026-03-14T08:10:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone-Wells' },
        },
      ],
    });

    expect(result.deltas).toEqual([
      expect.objectContaining({
        kind: 'CLAIM_CHANGED',
        claimType: 'PERSONAL_IDENTITY',
      }),
    ]);
    expect(result.alerts).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(notifier.deliveries).toHaveLength(0);

    const history = await engine.listEventHistory({ subscriptionId: subscription.subscriptionId });
    expect(history.map((event) => event.type)).toEqual(expect.arrayContaining([
      'CLAIM_CHANGE_DETECTED',
      'CHECK_COMPLETED',
    ]));
    expect(history.map((event) => event.type)).not.toContain('ALERT_EMITTED');
  });

  it('dedupes notifications within cooldown windows and re-allows them after cooldown', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const notifier = new CollectingWatchtowerNotifier();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
      notifier,
    });

    const subscription = await engine.createSubscription({
      subjectId: '4444444444',
      claimTypes: ['PERSONAL_IDENTITY'],
      alertSeverityFloor: 'MEDIUM',
      triggers: [
        {
          channel: 'SLACK',
          destination: '#watchtower',
          severityAtLeast: 'MEDIUM',
          cooldownMinutes: 30,
        },
      ],
    }, '2026-03-14T09:00:00.000Z');

    await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T09:00:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone' },
        },
      ],
    });

    const firstChange = await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T09:10:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone-Wells' },
        },
      ],
    });

    const secondChange = await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T09:20:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone-Williams' },
        },
      ],
    });

    const postCooldownChange = await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T09:45:00.000Z',
      claims: [
        {
          claimId: 'profile-name',
          claimType: 'PERSONAL_IDENTITY',
          status: 'ACTIVE',
          value: { firstName: 'Avery', lastName: 'Stone-Taylor' },
        },
      ],
    });

    expect(firstChange.notifications).toHaveLength(1);
    expect(secondChange.notifications).toHaveLength(0);
    expect(postCooldownChange.notifications).toHaveLength(1);
    expect(notifier.deliveries).toHaveLength(2);
  });

  it('records failed notification attempts without aborting the monitoring run', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const notifier = new FailingWatchtowerNotifier();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
      notifier,
    });

    const subscription = await engine.createSubscription({
      subjectId: '6666666666',
      claimTypes: ['LICENSE'],
      alertSeverityFloor: 'HIGH',
      triggers: [
        {
          channel: 'WEBHOOK',
          destination: 'https://ops.vitalcv.example/watchtower',
          severityAtLeast: 'HIGH',
        },
      ],
    }, '2026-03-14T10:00:00.000Z');

    await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T10:00:00.000Z',
      claims: [
        {
          claimId: 'license-ca',
          claimType: 'LICENSE',
          status: 'ACTIVE',
          value: { licenseNumber: 'CA-123', state: 'CA', status: 'ACTIVE' },
        },
      ],
    });

    const result = await engine.runCheck({
      subscriptionId: subscription.subscriptionId,
      checkedAt: '2026-03-14T10:30:00.000Z',
      claims: [
        {
          claimId: 'license-ca',
          claimType: 'LICENSE',
          status: 'REVOKED',
          value: { licenseNumber: 'CA-123', state: 'CA', status: 'REVOKED' },
        },
      ],
    });

    expect(result.notifications.length).toBeGreaterThan(0);
    expect(notifier.attempts).toHaveLength(result.notifications.length);

    const history = await engine.listEventHistory({ subscriptionId: subscription.subscriptionId });
    expect(history.map((event) => event.type)).toEqual(expect.arrayContaining([
      'NOTIFICATION_FAILED',
      'CHECK_COMPLETED',
    ]));
  });

  it('exposes subscription management helpers and respects active and due scheduling', async () => {
    const eventStore = new InMemoryWatchtowerEventStore();
    const engine = new WatchtowerMonitorEngine({
      eventStore,
    });

    const activeSubscription = await engine.createSubscription({
      subjectId: '8888888888',
      checkIntervalMinutes: 15,
      nextCheckAt: '2026-03-14T11:15:00.000Z',
    }, '2026-03-14T11:00:00.000Z');
    const pausedSubscription = await engine.createSubscription({
      subjectId: '8888888888',
      checkIntervalMinutes: 15,
      nextCheckAt: '2026-03-14T11:00:00.000Z',
    }, '2026-03-14T11:00:00.000Z');

    await engine.updateSubscription(pausedSubscription.subscriptionId, {
      active: false,
    }, '2026-03-14T11:01:00.000Z');
    await engine.scheduleVerificationCheck(activeSubscription.subscriptionId, '2026-03-14T11:20:00.000Z', '2026-03-14T11:05:00.000Z');

    expect(await engine.getSubscription(activeSubscription.subscriptionId)).toEqual(
      expect.objectContaining({
        nextCheckAt: '2026-03-14T11:20:00.000Z',
      }),
    );
    expect(await engine.listSubscriptions({ activeOnly: true })).toEqual([
      expect.objectContaining({
        subscriptionId: activeSubscription.subscriptionId,
      }),
    ]);
    expect(await engine.runDueChecks('2026-03-14T11:15:00.000Z')).toHaveLength(0);
    expect(await engine.runDueChecks('2026-03-14T11:20:00.000Z')).toHaveLength(1);
  });

  it('persists event history and subscriptions through the file-backed store and reads legacy snapshots', async () => {
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
      await store.putSnapshot({
        subscriptionId: subscription.subscriptionId,
        subjectId: '5555555555',
        checkedAt: '2026-03-14T08:55:00.000Z',
        claims: [
          {
            claimId: 'license-ca',
            claimType: 'LICENSE',
            status: 'ACTIVE',
            value: { licenseNumber: 'CA-123', state: 'CA', status: 'ACTIVE' },
          },
        ],
      });
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
      expect(await reloadedStore.getLatestSnapshot(subscription.subscriptionId, subscription.subjectId)).toEqual(
        expect.objectContaining({
          subscriptionId: 'watchsub_file',
          subjectId: '5555555555',
        }),
      );

      await fs.writeFile(filePath, JSON.stringify({
        events: [],
        snapshots: {
          '5555555555': {
            subjectId: '5555555555',
            checkedAt: '2026-03-14T08:30:00.000Z',
            claims: [
              {
                claimId: 'legacy-license',
                claimType: 'LICENSE',
                status: 'ACTIVE',
                value: { licenseNumber: 'CA-321', state: 'CA', status: 'ACTIVE' },
              },
            ],
          },
        },
        subscriptions: {
          watchsub_file: subscription,
        },
      }, null, 2));

      const legacyReloadedStore = new FileWatchtowerEventStore(filePath);
      expect(await legacyReloadedStore.getLatestSnapshot('watchsub_file', '5555555555')).toEqual(
        expect.objectContaining({
          subscriptionId: 'watchsub_file',
          subjectId: '5555555555',
          claims: [
            expect.objectContaining({
              claimId: 'legacy-license',
            }),
          ],
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
