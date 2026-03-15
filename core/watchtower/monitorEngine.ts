import { evaluateAlertRules, type WatchtowerAlertRuleConfig } from './alertRules';
import { detectClaimChanges } from './deltaDetector';
import {
  computeWatchtowerHash,
  type WatchtowerAlert,
  type WatchtowerClaim,
  type WatchtowerClaimDelta,
  type WatchtowerEvent,
  type WatchtowerEventStore,
  type WatchtowerNotificationRequest,
  type WatchtowerSnapshot,
  type WatchtowerSubscription,
} from './eventStore';
import {
  buildMonitoringSubscription,
  buildNotificationRequests,
  listDueSubscriptions,
  scheduleNextCheckAt,
  updateMonitoringSubscription,
  type MonitoringSubscriptionInput,
  type MonitoringSubscriptionPatch,
} from './subscriptions';

export interface WatchtowerClaimsProvider {
  fetchClaims(subscription: WatchtowerSubscription): Promise<readonly WatchtowerClaim[]>;
}

export interface WatchtowerNotificationDispatch {
  status: 'DELIVERED' | 'FAILED';
  detail?: Record<string, unknown>;
  error?: string;
}

export interface WatchtowerNotifier {
  notify(notification: WatchtowerNotificationRequest): Promise<WatchtowerNotificationDispatch>;
}

export interface WatchtowerRunCheckInput {
  subscriptionId: string;
  checkedAt?: string;
  claims?: readonly WatchtowerClaim[];
  metadata?: Record<string, unknown>;
}

export interface WatchtowerRunResult {
  subscription: WatchtowerSubscription;
  snapshot: WatchtowerSnapshot;
  deltas: readonly WatchtowerClaimDelta[];
  alerts: readonly WatchtowerAlert[];
  notifications: readonly WatchtowerNotificationRequest[];
}

export interface WatchtowerMonitorEngineOptions {
  eventStore: WatchtowerEventStore;
  claimsProvider?: WatchtowerClaimsProvider;
  notifier?: WatchtowerNotifier;
  alertRuleConfig?: WatchtowerAlertRuleConfig;
  includeAddedClaimsOnInitialCheck?: boolean;
}

class NullClaimsProvider implements WatchtowerClaimsProvider {
  async fetchClaims(): Promise<readonly WatchtowerClaim[]> {
    return [];
  }
}

class EventSinkNotifier implements WatchtowerNotifier {
  async notify(notification: WatchtowerNotificationRequest): Promise<WatchtowerNotificationDispatch> {
    return {
      status: 'DELIVERED',
      detail: {
        channel: notification.channel,
        destination: notification.destination ?? null,
      },
    };
  }
}

export class CollectingWatchtowerNotifier implements WatchtowerNotifier {
  readonly deliveries: WatchtowerNotificationRequest[] = [];

  async notify(notification: WatchtowerNotificationRequest): Promise<WatchtowerNotificationDispatch> {
    this.deliveries.push(notification);
    return { status: 'DELIVERED' };
  }
}

function eventId(type: WatchtowerEvent['type'], subjectId: string, occurredAt: string, payload: Record<string, unknown>): string {
  return `event_${computeWatchtowerHash({ type, subjectId, occurredAt, payload }).slice(0, 24)}`;
}

function createEvent(
  type: WatchtowerEvent['type'],
  subjectId: string,
  occurredAt: string,
  payload: Record<string, unknown>,
  subscriptionId?: string | null,
): WatchtowerEvent {
  return {
    eventId: eventId(type, subjectId, occurredAt, payload),
    type,
    subjectId,
    occurredAt,
    subscriptionId: subscriptionId ?? null,
    payload,
  };
}

export class WatchtowerMonitorEngine {
  private readonly claimsProvider: WatchtowerClaimsProvider;
  private readonly notifier: WatchtowerNotifier;
  private readonly alertRuleConfig?: WatchtowerAlertRuleConfig;
  private readonly includeAddedClaimsOnInitialCheck: boolean;

  constructor(private readonly options: WatchtowerMonitorEngineOptions) {
    this.claimsProvider = options.claimsProvider ?? new NullClaimsProvider();
    this.notifier = options.notifier ?? new EventSinkNotifier();
    this.alertRuleConfig = options.alertRuleConfig;
    this.includeAddedClaimsOnInitialCheck = options.includeAddedClaimsOnInitialCheck ?? false;
  }

  async createSubscription(
    input: MonitoringSubscriptionInput,
    now: string = new Date().toISOString(),
  ): Promise<WatchtowerSubscription> {
    const subscription = buildMonitoringSubscription(input, now);
    const savedSubscription = await this.options.eventStore.saveSubscription(subscription);

    await this.options.eventStore.appendEvents([
      createEvent('SUBSCRIPTION_SAVED', savedSubscription.subjectId, now, {
        subscriptionId: savedSubscription.subscriptionId,
        checkIntervalMinutes: savedSubscription.checkIntervalMinutes,
        alertSeverityFloor: savedSubscription.alertSeverityFloor,
      }, savedSubscription.subscriptionId),
      createEvent('CHECK_SCHEDULED', savedSubscription.subjectId, now, {
        subscriptionId: savedSubscription.subscriptionId,
        nextCheckAt: savedSubscription.nextCheckAt,
      }, savedSubscription.subscriptionId),
    ]);

    return savedSubscription;
  }

  async updateSubscription(
    subscriptionId: string,
    patch: MonitoringSubscriptionPatch,
    now: string = new Date().toISOString(),
  ): Promise<WatchtowerSubscription> {
    const existingSubscription = await this.options.eventStore.getSubscription(subscriptionId);
    if (!existingSubscription) {
      throw new Error(`Unknown watchtower subscription: ${subscriptionId}`);
    }

    const updatedSubscription = updateMonitoringSubscription(existingSubscription, patch, now);
    const savedSubscription = await this.options.eventStore.saveSubscription(updatedSubscription);

    await this.options.eventStore.appendEvents([
      createEvent('SUBSCRIPTION_SAVED', savedSubscription.subjectId, now, {
        subscriptionId: savedSubscription.subscriptionId,
        checkIntervalMinutes: savedSubscription.checkIntervalMinutes,
        alertSeverityFloor: savedSubscription.alertSeverityFloor,
      }, savedSubscription.subscriptionId),
    ]);

    return savedSubscription;
  }

  async scheduleVerificationCheck(
    subscriptionId: string,
    nextCheckAt: string,
    occurredAt: string = new Date().toISOString(),
  ): Promise<WatchtowerSubscription> {
    const existingSubscription = await this.options.eventStore.getSubscription(subscriptionId);
    if (!existingSubscription) {
      throw new Error(`Unknown watchtower subscription: ${subscriptionId}`);
    }

    const updatedSubscription = updateMonitoringSubscription(existingSubscription, { nextCheckAt }, occurredAt);
    const savedSubscription = await this.options.eventStore.saveSubscription(updatedSubscription);

    await this.options.eventStore.appendEvents([
      createEvent('CHECK_SCHEDULED', savedSubscription.subjectId, occurredAt, {
        subscriptionId: savedSubscription.subscriptionId,
        nextCheckAt: savedSubscription.nextCheckAt,
      }, savedSubscription.subscriptionId),
    ]);

    return savedSubscription;
  }

  async runDueChecks(now: string = new Date().toISOString()): Promise<WatchtowerRunResult[]> {
    const subscriptions = await this.options.eventStore.listSubscriptions({ activeOnly: true, dueBefore: now });
    const dueSubscriptions = listDueSubscriptions(subscriptions, now);
    const results: WatchtowerRunResult[] = [];

    for (const subscription of dueSubscriptions) {
      results.push(await this.runCheck({ subscriptionId: subscription.subscriptionId, checkedAt: now }));
    }

    return results;
  }

  async runCheck(input: WatchtowerRunCheckInput): Promise<WatchtowerRunResult> {
    const subscription = await this.options.eventStore.getSubscription(input.subscriptionId);
    if (!subscription) {
      throw new Error(`Unknown watchtower subscription: ${input.subscriptionId}`);
    }

    const checkedAt = input.checkedAt ?? new Date().toISOString();
    const claims = input.claims ?? await this.claimsProvider.fetchClaims(subscription);
    const snapshot: WatchtowerSnapshot = {
      subjectId: subscription.subjectId,
      checkedAt,
      claims,
      metadata: input.metadata,
    };
    const previousSnapshot = await this.options.eventStore.getLatestSnapshot(subscription.subjectId);
    const allDeltas = detectClaimChanges(previousSnapshot, snapshot, {
      includeAddedClaimsOnInitialCheck: this.includeAddedClaimsOnInitialCheck,
    });
    const deltas = subscription.claimTypes && subscription.claimTypes.length > 0
      ? allDeltas.filter((delta) => subscription.claimTypes?.includes(delta.claimType))
      : allDeltas;
    const alerts = evaluateAlertRules(deltas, {
      checkedAt,
      subscription,
      config: this.alertRuleConfig,
    });

    const historicalEvents = await this.options.eventStore.listEvents({
      subscriptionId: subscription.subscriptionId,
      types: ['NOTIFICATION_TRIGGERED'],
    });
    const notifications = buildNotificationRequests(subscription, alerts, historicalEvents, checkedAt);
    const notificationEvents: WatchtowerEvent[] = [];

    for (const notification of notifications) {
      const dispatch = await this.notifier.notify(notification);
      const eventType = dispatch.status === 'DELIVERED' ? 'NOTIFICATION_TRIGGERED' : 'NOTIFICATION_FAILED';
      notificationEvents.push(createEvent(eventType, subscription.subjectId, checkedAt, {
        notificationId: notification.notificationId,
        notificationKey: notification.notificationKey,
        triggerId: notification.triggerId,
        alertId: notification.alertId,
        channel: notification.channel,
        destination: notification.destination ?? null,
        detail: dispatch.detail ?? null,
        error: dispatch.error ?? null,
      }, subscription.subscriptionId));
    }

    const updatedSubscription = updateMonitoringSubscription(subscription, {
      lastCheckedAt: checkedAt,
      nextCheckAt: scheduleNextCheckAt(checkedAt, subscription.checkIntervalMinutes),
    }, checkedAt);

    await this.options.eventStore.putSnapshot(snapshot);
    const savedSubscription = await this.options.eventStore.saveSubscription(updatedSubscription);

    const events: WatchtowerEvent[] = [
      ...deltas.map((delta) => createEvent('CLAIM_CHANGE_DETECTED', delta.subjectId, checkedAt, {
        deltaId: delta.deltaId,
        kind: delta.kind,
        claimId: delta.claimId,
        claimType: delta.claimType,
        previousStatus: delta.previousStatus ?? null,
        currentStatus: delta.currentStatus ?? null,
      }, savedSubscription.subscriptionId)),
      ...alerts.map((alert) => createEvent('ALERT_EMITTED', alert.subjectId, checkedAt, {
        alertId: alert.alertId,
        deltaId: alert.deltaId,
        severity: alert.severity,
        claimId: alert.claimId,
        claimType: alert.claimType,
      }, savedSubscription.subscriptionId)),
      createEvent('CHECK_COMPLETED', savedSubscription.subjectId, checkedAt, {
        subscriptionId: savedSubscription.subscriptionId,
        deltaCount: deltas.length,
        alertCount: alerts.length,
        notificationCount: notifications.length,
      }, savedSubscription.subscriptionId),
      createEvent('CHECK_SCHEDULED', savedSubscription.subjectId, checkedAt, {
        subscriptionId: savedSubscription.subscriptionId,
        nextCheckAt: savedSubscription.nextCheckAt,
      }, savedSubscription.subscriptionId),
      ...notificationEvents,
    ];

    await this.options.eventStore.appendEvents(events);

    return {
      subscription: savedSubscription,
      snapshot,
      deltas,
      alerts,
      notifications,
    };
  }
}
