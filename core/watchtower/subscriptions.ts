import {
  alertSeverityRank,
  computeWatchtowerHash,
  type WatchtowerAlert,
  type WatchtowerAlertSeverity,
  type WatchtowerEvent,
  type WatchtowerNotificationRequest,
  type WatchtowerNotificationTrigger,
  type WatchtowerSubscription,
} from './eventStore';

export interface MonitoringSubscriptionInput {
  subscriptionId?: string;
  subjectId: string;
  active?: boolean;
  checkIntervalMinutes?: number;
  nextCheckAt?: string;
  lastCheckedAt?: string | null;
  alertSeverityFloor?: WatchtowerAlertSeverity;
  claimTypes?: readonly string[];
  triggers?: readonly Partial<WatchtowerNotificationTrigger>[];
  metadata?: Record<string, unknown>;
}

export interface MonitoringSubscriptionPatch {
  active?: boolean;
  checkIntervalMinutes?: number;
  nextCheckAt?: string;
  lastCheckedAt?: string | null;
  alertSeverityFloor?: WatchtowerAlertSeverity;
  claimTypes?: readonly string[];
  triggers?: readonly Partial<WatchtowerNotificationTrigger>[];
  metadata?: Record<string, unknown>;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sanitizeClaimTypes(claimTypes?: readonly string[]): readonly string[] | undefined {
  if (!claimTypes || claimTypes.length === 0) {
    return undefined;
  }

  const unique = [...new Set(claimTypes.map((claimType) => claimType.trim()).filter(Boolean))];
  return unique.length > 0 ? unique : undefined;
}

function normalizeTrigger(
  subscriptionId: string,
  trigger: Partial<WatchtowerNotificationTrigger>,
  fallbackSeverity: WatchtowerAlertSeverity,
): WatchtowerNotificationTrigger {
  if (!trigger.channel) {
    throw new Error('Notification trigger channel is required.');
  }

  const cooldownMinutes = Math.max(0, Math.floor(trigger.cooldownMinutes ?? 0));
  const deltaKinds = trigger.deltaKinds && trigger.deltaKinds.length > 0
    ? [...new Set(trigger.deltaKinds)]
    : undefined;
  const triggerId = trigger.triggerId ?? `trigger_${computeWatchtowerHash({
    subscriptionId,
    channel: trigger.channel,
    destination: trigger.destination ?? null,
    severityAtLeast: trigger.severityAtLeast ?? fallbackSeverity,
    cooldownMinutes,
    deltaKinds: deltaKinds ?? null,
  }).slice(0, 24)}`;

  return {
    triggerId,
    channel: trigger.channel,
    destination: trigger.destination ?? null,
    severityAtLeast: trigger.severityAtLeast ?? fallbackSeverity,
    deltaKinds,
    cooldownMinutes,
    enabled: trigger.enabled ?? true,
  };
}

export function scheduleNextCheckAt(from: string | Date, intervalMinutes: number): string {
  const baseTime = new Date(from);
  const nextTime = new Date(baseTime.getTime() + Math.max(1, Math.floor(intervalMinutes)) * 60 * 1000);
  return nextTime.toISOString();
}

export function buildMonitoringSubscription(
  input: MonitoringSubscriptionInput,
  now: string | Date = new Date(),
): WatchtowerSubscription {
  if (!input.subjectId || input.subjectId.trim().length === 0) {
    throw new Error('subjectId is required.');
  }

  const intervalMinutes = Math.max(1, Math.floor(input.checkIntervalMinutes ?? 60));
  const createdAt = toIsoString(now);
  const claimTypes = sanitizeClaimTypes(input.claimTypes);
  const alertSeverityFloor = input.alertSeverityFloor ?? 'MEDIUM';
  const subscriptionId = input.subscriptionId ?? `watchsub_${computeWatchtowerHash({
    subjectId: input.subjectId,
    createdAt,
    intervalMinutes,
    claimTypes: claimTypes ?? null,
  }).slice(0, 24)}`;
  const rawTriggers: Partial<WatchtowerNotificationTrigger>[] = input.triggers && input.triggers.length > 0
    ? [...input.triggers]
    : [{ channel: 'INTERNAL', severityAtLeast: alertSeverityFloor }];

  return {
    subscriptionId,
    subjectId: input.subjectId.trim(),
    active: input.active ?? true,
    checkIntervalMinutes: intervalMinutes,
    nextCheckAt: input.nextCheckAt ?? createdAt,
    lastCheckedAt: input.lastCheckedAt ?? null,
    alertSeverityFloor,
    claimTypes,
    triggers: rawTriggers.map((trigger) => normalizeTrigger(subscriptionId, trigger, alertSeverityFloor)),
    createdAt,
    updatedAt: createdAt,
    metadata: input.metadata,
  };
}

export function updateMonitoringSubscription(
  subscription: WatchtowerSubscription,
  patch: MonitoringSubscriptionPatch,
  now: string | Date = new Date(),
): WatchtowerSubscription {
  const updatedAt = toIsoString(now);
  const alertSeverityFloor = patch.alertSeverityFloor ?? subscription.alertSeverityFloor;

  return {
    ...subscription,
    active: patch.active ?? subscription.active,
    checkIntervalMinutes: patch.checkIntervalMinutes
      ? Math.max(1, Math.floor(patch.checkIntervalMinutes))
      : subscription.checkIntervalMinutes,
    nextCheckAt: patch.nextCheckAt ?? subscription.nextCheckAt,
    lastCheckedAt: patch.lastCheckedAt !== undefined ? patch.lastCheckedAt : subscription.lastCheckedAt ?? null,
    alertSeverityFloor,
    claimTypes: patch.claimTypes !== undefined ? sanitizeClaimTypes(patch.claimTypes) : subscription.claimTypes,
    triggers: patch.triggers !== undefined
      ? patch.triggers.map((trigger) => normalizeTrigger(subscription.subscriptionId, trigger, alertSeverityFloor))
      : subscription.triggers,
    metadata: patch.metadata ?? subscription.metadata,
    updatedAt,
  };
}

export function isSubscriptionDue(
  subscription: WatchtowerSubscription,
  now: string | Date = new Date(),
): boolean {
  if (!subscription.active) {
    return false;
  }

  return Date.parse(subscription.nextCheckAt) <= Date.parse(toIsoString(now));
}

export function listDueSubscriptions(
  subscriptions: readonly WatchtowerSubscription[],
  now: string | Date = new Date(),
): WatchtowerSubscription[] {
  return subscriptions
    .filter((subscription) => isSubscriptionDue(subscription, now))
    .sort((left, right) => Date.parse(left.nextCheckAt) - Date.parse(right.nextCheckAt));
}

export function alertMatchesSubscription(
  subscription: WatchtowerSubscription,
  alert: WatchtowerAlert,
): boolean {
  if (alertSeverityRank(alert.severity) < alertSeverityRank(subscription.alertSeverityFloor)) {
    return false;
  }

  if (subscription.claimTypes && subscription.claimTypes.length > 0 && !subscription.claimTypes.includes(alert.claimType)) {
    return false;
  }

  return true;
}

function notificationAlreadyTriggeredRecently(
  events: readonly WatchtowerEvent[],
  notificationKey: string,
  cooldownMinutes: number,
  now: string,
): boolean {
  if (cooldownMinutes <= 0) {
    return false;
  }

  const cooldownWindowStart = Date.parse(now) - cooldownMinutes * 60 * 1000;
  return events.some((event) => {
    if (event.type !== 'NOTIFICATION_TRIGGERED') {
      return false;
    }

    if (Date.parse(event.occurredAt) < cooldownWindowStart) {
      return false;
    }

    return event.payload.notificationKey === notificationKey;
  });
}

export function buildNotificationRequests(
  subscription: WatchtowerSubscription,
  alerts: readonly WatchtowerAlert[],
  historicalEvents: readonly WatchtowerEvent[],
  now: string | Date = new Date(),
): WatchtowerNotificationRequest[] {
  const occurredAt = toIsoString(now);
  const requests: WatchtowerNotificationRequest[] = [];

  for (const alert of alerts) {
    if (!alertMatchesSubscription(subscription, alert)) {
      continue;
    }

    for (const trigger of subscription.triggers) {
      if (!trigger.enabled) {
        continue;
      }

      if (alertSeverityRank(alert.severity) < alertSeverityRank(trigger.severityAtLeast)) {
        continue;
      }

      if (trigger.deltaKinds && trigger.deltaKinds.length > 0 && !trigger.deltaKinds.includes(alert.deltaKind)) {
        continue;
      }

      const notificationKey = `notify_${computeWatchtowerHash({
        subscriptionId: subscription.subscriptionId,
        triggerId: trigger.triggerId,
        claimId: alert.claimId,
        claimType: alert.claimType,
        deltaKind: alert.deltaKind,
      }).slice(0, 24)}`;

      if (notificationAlreadyTriggeredRecently(historicalEvents, notificationKey, trigger.cooldownMinutes, occurredAt)) {
        continue;
      }

      requests.push({
        notificationId: `delivery_${computeWatchtowerHash({
          notificationKey,
          occurredAt,
          alertId: alert.alertId,
        }).slice(0, 24)}`,
        notificationKey,
        subscriptionId: subscription.subscriptionId,
        subjectId: subscription.subjectId,
        triggerId: trigger.triggerId,
        alertId: alert.alertId,
        channel: trigger.channel,
        destination: trigger.destination ?? null,
        severity: alert.severity,
        deltaKind: alert.deltaKind,
        occurredAt,
        payload: {
          title: alert.title,
          description: alert.description,
          recommendedAction: alert.recommendedAction,
          claimId: alert.claimId,
          claimType: alert.claimType,
          notificationKey,
        },
      });
    }
  }

  return requests;
}
