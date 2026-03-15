import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  createWatchlist,
  listWatchlists,
  type MonitoringSeverity,
  type WatchlistRecord,
} from '../identity/watchtowerStore';
import {
  DEFAULT_MOBILE_LIMIT,
  MAX_MOBILE_LIMIT,
  WATCHTOWER_MOBILE_SCHEMA,
  mapAlertToMobileItem,
  paginateMobileItems,
  type MobileAlertItem,
  type WatchtowerMobilePayload,
} from './payloads';

type MobilePlatform = 'ios' | 'android';
type AlertDeliveryStatus = 'DELIVERED' | 'PENDING' | 'SUPPRESSED' | 'DEDUPED' | 'FAILED' | 'NOT_CONFIGURED';

type MobileSubscriptionMetadata = {
  subscriptionId: string;
  subscriptionName: string;
  platform: MobilePlatform;
  deviceHash: string;
  trustScoreDrops: boolean;
  anomalyEvents: boolean;
  createdAt: string;
};

export type CreateMobileWatchtowerSubscriptionInput = Readonly<{
  name?: string;
  ownerOrganizationId?: string;
  monitoredProviders?: readonly string[];
  monitoredInstitutions?: readonly string[];
  trustScoreDrops?: boolean;
  anomalyEvents?: boolean;
  severityFloor?: MonitoringSeverity;
  deviceId: string;
  platform: MobilePlatform;
}>;

export type MobileWatchtowerSubscriptionSummary = Readonly<{
  subscriptionId: string;
  name: string;
  platform: MobilePlatform;
  severityFloor: MonitoringSeverity;
  monitoredProviders: string[];
  monitoredInstitutions: string[];
  trustScoreDrops: boolean;
  anomalyEvents: boolean;
  watchlistIds: string[];
  createdAt: string;
}>;

export type MobileWatchtowerQueueOptions = Readonly<{
  subscriptionId: string;
  limit?: number;
  cursor?: string | null;
  statuses?: readonly AlertDeliveryStatus[];
}>;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeUnique(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2002'
  );
}

function readMobileMetadata(record: WatchlistRecord): MobileSubscriptionMetadata | null {
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const mobile = (metadata as { mobile?: unknown }).mobile;
  if (!mobile || typeof mobile !== 'object' || Array.isArray(mobile)) {
    return null;
  }

  const mobileRecord = mobile as Record<string, unknown>;
  const subscriptionId = typeof mobileRecord.subscriptionId === 'string' ? mobileRecord.subscriptionId : null;
  const subscriptionName = typeof mobileRecord.subscriptionName === 'string' ? mobileRecord.subscriptionName : null;
  const platform = mobileRecord.platform === 'android' ? 'android' : mobileRecord.platform === 'ios' ? 'ios' : null;
  const deviceHash = typeof mobileRecord.deviceHash === 'string' ? mobileRecord.deviceHash : null;

  if (!subscriptionId || !subscriptionName || !platform || !deviceHash) {
    return null;
  }

  return {
    subscriptionId,
    subscriptionName,
    platform,
    deviceHash,
    trustScoreDrops: mobileRecord.trustScoreDrops !== false,
    anomalyEvents: mobileRecord.anomalyEvents !== false,
    createdAt: typeof mobileRecord.createdAt === 'string' ? mobileRecord.createdAt : record.createdAt.toISOString(),
  };
}

function buildSubscriptionId(input: {
  name: string;
  monitoredProviders: readonly string[];
  monitoredInstitutions: readonly string[];
  deviceHash: string;
  platform: MobilePlatform;
}): string {
  return `mobsub_${stableHash({
    name: input.name,
    monitoredProviders: [...input.monitoredProviders].sort(),
    monitoredInstitutions: [...input.monitoredInstitutions].sort(),
    deviceHash: input.deviceHash,
    platform: input.platform,
  }).slice(0, 24)}`;
}

function classifySubscriptionTargetType(record: WatchlistRecord): 'provider' | 'institution' | null {
  if (record.targetType === 'PROVIDER') {
    return 'provider';
  }
  if (record.targetType === 'INSTITUTION') {
    return 'institution';
  }
  return null;
}

async function loadMobileWatchlists(subscriptionId: string): Promise<WatchlistRecord[]> {
  const watchlists = await listWatchlists({ activeOnly: true });
  return watchlists.filter((record) => readMobileMetadata(record)?.subscriptionId === subscriptionId);
}

function buildSummaryFromWatchlists(
  watchlists: readonly WatchlistRecord[],
): MobileWatchtowerSubscriptionSummary | null {
  const first = watchlists[0];
  if (!first) {
    return null;
  }

  const mobile = readMobileMetadata(first);
  if (!mobile) {
    return null;
  }

  const monitoredProviders = watchlists
    .filter((record) => classifySubscriptionTargetType(record) === 'provider')
    .map((record) => record.targetValue);
  const monitoredInstitutions = watchlists
    .filter((record) => classifySubscriptionTargetType(record) === 'institution')
    .map((record) => record.targetValue);

  return {
    subscriptionId: mobile.subscriptionId,
    name: mobile.subscriptionName,
    platform: mobile.platform,
    severityFloor: first.severityFloor,
    monitoredProviders,
    monitoredInstitutions,
    trustScoreDrops: mobile.trustScoreDrops,
    anomalyEvents: mobile.anomalyEvents,
    watchlistIds: watchlists.map((record) => record.id),
    createdAt: mobile.createdAt,
  };
}

async function createOrLoadWatchlist(input: Parameters<typeof createWatchlist>[0]): Promise<WatchlistRecord> {
  try {
    return await createWatchlist(input);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await listWatchlists({ activeOnly: true, targetType: input.targetType, targetValue: input.targetValue });
    const match = existing.find((record) => {
      const mobile = readMobileMetadata(record);
      return mobile?.subscriptionId === (input.metadata as { mobile?: { subscriptionId?: string } } | undefined)?.mobile?.subscriptionId;
    });

    if (!match) {
      throw error;
    }

    return match;
  }
}

export async function createMobileWatchtowerSubscription(
  input: CreateMobileWatchtowerSubscriptionInput,
): Promise<MobileWatchtowerSubscriptionSummary> {
  const monitoredProviders = normalizeUnique(input.monitoredProviders);
  const monitoredInstitutions = normalizeUnique(input.monitoredInstitutions);

  if (monitoredProviders.length === 0 && monitoredInstitutions.length === 0) {
    throw new Error('At least one monitored provider or institution is required.');
  }

  const deviceId = input.deviceId.trim();
  if (!deviceId) {
    throw new Error('deviceId is required.');
  }

  const subscriptionName = (input.name?.trim() || 'Mobile watchtower subscription').slice(0, 120);
  const deviceHash = createHash('sha256').update(deviceId).digest('hex');
  const subscriptionId = buildSubscriptionId({
    name: subscriptionName,
    monitoredProviders,
    monitoredInstitutions,
    deviceHash,
    platform: input.platform,
  });
  const severityFloor = input.severityFloor ?? 'MEDIUM';
  const destination = `mobile://${subscriptionId}/${deviceHash.slice(0, 16)}`;
  const createdAt = new Date().toISOString();

  const metadata = {
    mobile: {
      subscriptionId,
      subscriptionName,
      platform: input.platform,
      deviceHash,
      trustScoreDrops: input.trustScoreDrops !== false,
      anomalyEvents: input.anomalyEvents !== false,
      createdAt,
    },
  };

  const watchlists = await Promise.all([
    ...monitoredProviders.map((providerNpi) =>
      createOrLoadWatchlist({
        name: `${subscriptionName}:provider:${providerNpi}`,
        ownerOrganizationId: input.ownerOrganizationId,
        targetType: 'PROVIDER',
        targetValue: providerNpi,
        severityFloor,
        deliveryChannels: ['INTERNAL_FEED', 'EVENT_SINK'],
        webhookUrl: destination,
        metadata,
      })),
    ...monitoredInstitutions.map((institutionKey) =>
      createOrLoadWatchlist({
        name: `${subscriptionName}:institution:${institutionKey}`,
        ownerOrganizationId: input.ownerOrganizationId,
        targetType: 'INSTITUTION',
        targetValue: institutionKey,
        severityFloor,
        deliveryChannels: ['INTERNAL_FEED', 'EVENT_SINK'],
        webhookUrl: destination,
        metadata,
      })),
  ]);

  const summary = buildSummaryFromWatchlists(watchlists);
  if (!summary) {
    throw new Error('Failed to build mobile subscription summary.');
  }

  log('info', 'watchtower_mobile_subscription_created', {
    subscriptionId,
    providerCount: monitoredProviders.length,
    institutionCount: monitoredInstitutions.length,
    platform: input.platform,
  });

  return summary;
}

export async function listMobileWatchtowerSubscriptions(
  ownerOrganizationId?: string,
): Promise<MobileWatchtowerSubscriptionSummary[]> {
  const watchlists = await listWatchlists({ activeOnly: true });
  const filtered = ownerOrganizationId
    ? watchlists.filter((record) => record.ownerOrganizationId === ownerOrganizationId)
    : watchlists;

  const grouped = new Map<string, WatchlistRecord[]>();
  for (const record of filtered) {
    const mobile = readMobileMetadata(record);
    if (!mobile) {
      continue;
    }
    const bucket = grouped.get(mobile.subscriptionId) ?? [];
    bucket.push(record);
    grouped.set(mobile.subscriptionId, bucket);
  }

  return [...grouped.values()]
    .map((records) => buildSummaryFromWatchlists(records))
    .filter((value): value is MobileWatchtowerSubscriptionSummary => Boolean(value))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

type AlertRow = {
  id: string;
  alertId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  subject: string | null;
  recommendedAction: string;
  observedAt: Date | null;
  createdAt: Date;
};

type DeliveryAttemptRow = {
  id: string;
  trustAlertRecordId: string | null;
  watchlistId: string | null;
  status: AlertDeliveryStatus;
  createdAt: Date;
};

function allowAlertForSubscription(
  subscription: MobileWatchtowerSubscriptionSummary,
  item: MobileAlertItem,
): boolean {
  if (item.type === 'TRUST_SCORE_DROP' && !subscription.trustScoreDrops) {
    return false;
  }
  if (item.type === 'ANOMALY_EVENT' && !subscription.anomalyEvents) {
    return false;
  }
  return true;
}

export async function loadMobileWatchtowerQueue(
  options: MobileWatchtowerQueueOptions,
): Promise<WatchtowerMobilePayload> {
  const watchlists = await loadMobileWatchlists(options.subscriptionId);
  const summary = buildSummaryFromWatchlists(watchlists);
  if (!summary) {
    throw new Error(`Unknown mobile watchtower subscription: ${options.subscriptionId}`);
  }

  const statuses: AlertDeliveryStatus[] = (options.statuses?.length ?? 0) > 0
    ? [...new Set(options.statuses ?? [])]
    : ['PENDING'];
  const limit = Math.max(1, Math.min(MAX_MOBILE_LIMIT, options.limit ?? DEFAULT_MOBILE_LIMIT));

  const attempts = await prisma.alertDeliveryAttempt.findMany({
    where: {
      watchlistId: { in: summary.watchlistIds },
      channel: 'EVENT_SINK',
      status: { in: statuses },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 250,
  }) as DeliveryAttemptRow[];

  const alertIds = attempts
    .map((attempt) => attempt.trustAlertRecordId)
    .filter((value): value is string => typeof value === 'string');
  const alertRows = alertIds.length > 0
    ? await prisma.trustAlertRecord.findMany({
        where: { id: { in: alertIds } },
        orderBy: { createdAt: 'desc' },
      }) as AlertRow[]
    : [];
  const alertMap = new Map(alertRows.map((row) => [row.id, row]));

  const mobileAlerts = attempts.flatMap((attempt) => {
    if (!attempt.trustAlertRecordId) {
      return [];
    }
    const alert = alertMap.get(attempt.trustAlertRecordId);
    if (!alert) {
      return [];
    }

    const item = mapAlertToMobileItem({
      eventId: attempt.id,
      alertId: alert.alertId,
      type: alert.type,
      subject: alert.subject,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      observedAt: alert.observedAt,
      createdAt: alert.createdAt,
      status: attempt.status,
      recommendedAction: alert.recommendedAction,
    });

    return allowAlertForSubscription(summary, item) ? [item] : [];
  });

  const paged = paginateMobileItems(mobileAlerts, limit, options.cursor ?? null);

  return {
    schema: WATCHTOWER_MOBILE_SCHEMA,
    view: 'mobile',
    generatedAt: new Date().toISOString(),
    subscriptionId: summary.subscriptionId,
    summary: {
      totalAlerts: mobileAlerts.length,
      criticalAlerts: mobileAlerts.filter((alert) => alert.severity === 'critical').length,
      highAlerts: mobileAlerts.filter((alert) => alert.severity === 'high').length,
      pendingQueueItems: mobileAlerts.filter((alert) => alert.status === 'PENDING').length,
    },
    alerts: paged.items,
    page: paged.page,
    links: {
      self: `/api/watchtower/mobile/queue?subscriptionId=${encodeURIComponent(summary.subscriptionId)}&limit=${limit}${paged.page.cursor ? `&cursor=${paged.page.cursor}` : ''}`,
      next: paged.page.nextCursor
        ? `/api/watchtower/mobile/queue?subscriptionId=${encodeURIComponent(summary.subscriptionId)}&limit=${limit}&cursor=${paged.page.nextCursor}`
        : null,
      subscribe: '/api/watchtower/mobile/subscriptions',
    },
  };
}

export async function acknowledgeMobileWatchtowerQueueItem(
  subscriptionId: string,
  deliveryAttemptId: string,
): Promise<{ deliveryAttemptId: string; status: AlertDeliveryStatus } | null> {
  const watchlists = await loadMobileWatchlists(subscriptionId);
  if (watchlists.length === 0) {
    return null;
  }

  const watchlistIds = watchlists.map((watchlist) => watchlist.id);
  const existing = await prisma.alertDeliveryAttempt.findFirst({
    where: {
      id: deliveryAttemptId,
      watchlistId: { in: watchlistIds },
      channel: 'EVENT_SINK',
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.alertDeliveryAttempt.update({
    where: { id: deliveryAttemptId },
    data: {
      status: 'DELIVERED',
      responseCode: 200,
      errorText: null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  log('info', 'watchtower_mobile_queue_acknowledged', {
    subscriptionId,
    deliveryAttemptId,
  });

  return {
    deliveryAttemptId: updated.id,
    status: updated.status as AlertDeliveryStatus,
  };
}
