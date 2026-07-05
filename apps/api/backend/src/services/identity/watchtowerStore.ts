import { createHash, randomUUID } from 'node:crypto';
import prisma, { Prisma } from '../../graphql/prisma_client';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2002'
  );
}

function toNullableDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

export type MonitoringSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CreateWatchlistInput = Readonly<{
  name: string;
  ownerOrganizationId?: string;
  targetType: 'PROVIDER' | 'INSTITUTION' | 'CLAIM_CLASS';
  targetValue: string;
  claimType?: string;
  fieldPath?: string;
  severityFloor?: MonitoringSeverity;
  suppressionWindowMinutes?: number;
  deliveryChannels?: readonly string[];
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}>;

export type WatchlistRecord = Readonly<{
  id: string;
  name: string;
  ownerOrganizationId: string | null;
  targetType: 'PROVIDER' | 'INSTITUTION' | 'CLAIM_CLASS';
  targetValue: string;
  claimType: string | null;
  fieldPath: string | null;
  severityFloor: MonitoringSeverity;
  suppressionWindowMinutes: number;
  deliveryChannels: string[];
  webhookUrl: string | null;
  active: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type PersistEntityChangeEventInput = Readonly<{
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  identityDeltaId?: string | null;
  subjectNpi: string;
  sourceId: string;
  claimType?: string | null;
  fieldPath?: string | null;
  eventType:
    | 'CLAIM_VALUE_CHANGED'
    | 'CLAIM_EXPIRED'
    | 'NEW_SANCTION_HIT'
    | 'NEW_PAYMENT_RELATIONSHIP'
    | 'PROVIDER_MOVED_ORGANIZATION'
    | 'PROVIDER_MOVED_LOCATION'
    | 'LICENSE_STATE_CHANGED'
    | 'LICENSE_STATUS_CHANGED'
    | 'BOARD_CERT_STATUS_CHANGED';
  severity: MonitoringSeverity;
  previousValue?: unknown;
  currentValue?: unknown;
  metadata?: Record<string, unknown>;
  observedAt: string;
  checksum: string;
}>;

export type PersistSourceStalenessEventInput = Readonly<{
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  subjectNpi: string;
  sourceId: string;
  status: 'STALE' | 'DISAPPEARED';
  severity: MonitoringSeverity;
  slaHours: number;
  trustTier?: string | null;
  lastObservedAt?: string | null;
  staleSince: string;
  metadata?: Record<string, unknown>;
  checksum: string;
}>;

export type PersistTrustDegradationEventInput = Readonly<{
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  entityChangeEventId?: string | null;
  sourceStalenessEventId?: string | null;
  subjectNpi: string;
  claimType?: string | null;
  reason:
    | 'CLAIM_EXPIRED'
    | 'NEW_SANCTION_HIT'
    | 'LICENSE_STATUS_CHANGED'
    | 'BOARD_CERT_STATUS_CHANGED'
    | 'SOURCE_STALE'
    | 'SOURCE_DISAPPEARED';
  severity: MonitoringSeverity;
  description: string;
  metadata?: Record<string, unknown>;
  observedAt: string;
  checksum: string;
}>;

export type PersistWatchlistHitInput = Readonly<{
  watchlistId: string;
  trustAlertRecordId?: string | null;
  entityChangeEventId?: string | null;
  sourceStalenessEventId?: string | null;
  trustDegradationEventId?: string | null;
  subjectNpi?: string | null;
  organizationKey?: string | null;
  claimType?: string | null;
  fieldPath?: string | null;
  severity: MonitoringSeverity;
  payload?: Record<string, unknown>;
  observedAt: string;
  dedupeKey: string;
}>;

export type PersistAlertDeliveryAttemptInput = Readonly<{
  trustAlertRecordId?: string | null;
  watchlistId?: string | null;
  channel: 'INTERNAL_FEED' | 'WEBHOOK' | 'EVENT_SINK' | 'EMAIL' | 'SLACK';
  destination?: string | null;
  status: 'DELIVERED' | 'PENDING' | 'SUPPRESSED' | 'DEDUPED' | 'FAILED' | 'NOT_CONFIGURED';
  payload?: Record<string, unknown>;
  responseCode?: number | null;
  errorText?: string | null;
  dedupeKey: string;
}>;

type LatestSourceRecordRow = Readonly<{
  id: string;
  sourceId: string;
  subjectNpi: string;
  trustTier: string | null;
  fetchedAt: Date;
  observedAt: Date | null;
  sourceRunId: string | null;
  metadata: Prisma.JsonValue | null;
}>;

type WatchtowerStorePrismaClient = {
  watchlist: {
    create(args: Record<string, unknown>): Promise<WatchlistRecord>;
    findMany(args: Record<string, unknown>): Promise<WatchlistRecord[]>;
  };
  entityChangeEvent: {
    create(args: Record<string, unknown>): Promise<{ id: string; checksum: string }>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  sourceStalenessEvent: {
    create(args: Record<string, unknown>): Promise<{ id: string; checksum: string }>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  trustDegradationEvent: {
    create(args: Record<string, unknown>): Promise<{ id: string; checksum: string }>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  watchlistHit: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  alertDeliveryAttempt: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  trustAlertRecord: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string; alertId: string; createdAt: Date } | null>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  sourceRecord: {
    findMany(args: Record<string, unknown>): Promise<LatestSourceRecordRow[]>;
  };
};

const watchtowerPrisma = prisma as unknown as WatchtowerStorePrismaClient;

export function buildWatchlistDedupeKey(input: Omit<CreateWatchlistInput, 'metadata'>): string {
  return stableHash({
    name: input.name.trim(),
    ownerOrganizationId: input.ownerOrganizationId ?? null,
    targetType: input.targetType,
    targetValue: input.targetValue.trim(),
    claimType: input.claimType ?? null,
    fieldPath: input.fieldPath ?? null,
    severityFloor: input.severityFloor ?? 'LOW',
    suppressionWindowMinutes: input.suppressionWindowMinutes ?? 1440,
    deliveryChannels: [...(input.deliveryChannels ?? ['INTERNAL_FEED'])].sort(),
    webhookUrl: input.webhookUrl ?? null,
  });
}

export async function createWatchlist(input: CreateWatchlistInput): Promise<WatchlistRecord> {
  return watchtowerPrisma.watchlist.create({
    data: {
      // watchlists.id has no DB default despite the schema's
      // dbgenerated(gen_random_uuid()) (verified in prod 2026-07-05) —
      // supply the id client-side or the insert throws P2011.
      id: randomUUID(),
      dedupeKey: buildWatchlistDedupeKey(input),
      name: input.name.trim(),
      ownerOrganizationId: input.ownerOrganizationId ?? null,
      targetType: input.targetType,
      targetValue: input.targetValue.trim(),
      claimType: input.claimType ?? null,
      fieldPath: input.fieldPath ?? null,
      severityFloor: input.severityFloor ?? 'LOW',
      suppressionWindowMinutes: input.suppressionWindowMinutes ?? 1440,
      deliveryChannels: [...(input.deliveryChannels ?? ['INTERNAL_FEED'])],
      webhookUrl: input.webhookUrl ?? null,
      active: true,
      metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
    },
  });
}

export async function listWatchlists(options?: {
  activeOnly?: boolean;
  targetType?: CreateWatchlistInput['targetType'];
  targetValue?: string;
}): Promise<WatchlistRecord[]> {
  return watchtowerPrisma.watchlist.findMany({
    where: {
      ...(options?.activeOnly ? { active: true } : {}),
      ...(options?.targetType ? { targetType: options.targetType } : {}),
      ...(options?.targetValue ? { targetValue: options.targetValue } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createWithChecksumDedup<T extends { checksum?: string }>(
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
}

export async function persistEntityChangeEvent(
  input: PersistEntityChangeEventInput,
): Promise<{ id: string; checksum: string } | null> {
  return createWithChecksumDedup(() =>
    watchtowerPrisma.entityChangeEvent.create({
      data: {
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId ?? null,
        identityDeltaId: input.identityDeltaId ?? null,
        subjectNpi: input.subjectNpi,
        sourceId: input.sourceId,
        claimType: input.claimType ?? null,
        fieldPath: input.fieldPath ?? null,
        eventType: input.eventType,
        severity: input.severity,
        previousValue:
          typeof input.previousValue === 'undefined' ? undefined : toJsonValue(input.previousValue),
        currentValue:
          typeof input.currentValue === 'undefined' ? undefined : toJsonValue(input.currentValue),
        checksum: input.checksum,
        metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
        observedAt: new Date(input.observedAt),
      },
      select: {
        id: true,
        checksum: true,
      },
    }),
  );
}

export async function persistSourceStalenessEvent(
  input: PersistSourceStalenessEventInput,
): Promise<{ id: string; checksum: string } | null> {
  return createWithChecksumDedup(() =>
    watchtowerPrisma.sourceStalenessEvent.create({
      data: {
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId ?? null,
        subjectNpi: input.subjectNpi,
        sourceId: input.sourceId,
        status: input.status,
        severity: input.severity,
        slaHours: input.slaHours,
        trustTier: input.trustTier ?? null,
        lastObservedAt: toNullableDate(input.lastObservedAt),
        staleSince: new Date(input.staleSince),
        checksum: input.checksum,
        metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
      },
      select: {
        id: true,
        checksum: true,
      },
    }),
  );
}

export async function persistTrustDegradationEvent(
  input: PersistTrustDegradationEventInput,
): Promise<{ id: string; checksum: string } | null> {
  return createWithChecksumDedup(() =>
    watchtowerPrisma.trustDegradationEvent.create({
      data: {
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId ?? null,
        entityChangeEventId: input.entityChangeEventId ?? null,
        sourceStalenessEventId: input.sourceStalenessEventId ?? null,
        subjectNpi: input.subjectNpi,
        claimType: input.claimType ?? null,
        reason: input.reason,
        severity: input.severity,
        checksum: input.checksum,
        description: input.description,
        metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
        observedAt: new Date(input.observedAt),
      },
      select: {
        id: true,
        checksum: true,
      },
    }),
  );
}

export async function persistWatchlistHit(
  input: PersistWatchlistHitInput,
): Promise<{ id: string } | null> {
  try {
    return await watchtowerPrisma.watchlistHit.create({
      data: {
        // watchlist_hits.id has no DB default despite the schema's
        // dbgenerated(gen_random_uuid()) (verified in prod 2026-07-05) —
        // supply the id client-side or the insert throws P2011.
        id: randomUUID(),
        watchlistId: input.watchlistId,
        trustAlertRecordId: input.trustAlertRecordId ?? null,
        entityChangeEventId: input.entityChangeEventId ?? null,
        sourceStalenessEventId: input.sourceStalenessEventId ?? null,
        trustDegradationEventId: input.trustDegradationEventId ?? null,
        subjectNpi: input.subjectNpi ?? null,
        organizationKey: input.organizationKey ?? null,
        claimType: input.claimType ?? null,
        fieldPath: input.fieldPath ?? null,
        severity: input.severity,
        dedupeKey: input.dedupeKey,
        payload: input.payload ? toJsonValue(input.payload) : undefined,
        observedAt: new Date(input.observedAt),
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
}

export async function persistAlertDeliveryAttempt(
  input: PersistAlertDeliveryAttemptInput,
): Promise<{ id: string } | null> {
  try {
    return await watchtowerPrisma.alertDeliveryAttempt.create({
      data: {
        trustAlertRecordId: input.trustAlertRecordId ?? null,
        watchlistId: input.watchlistId ?? null,
        channel: input.channel,
        destination: input.destination ?? null,
        status: input.status,
        dedupeKey: input.dedupeKey,
        payload: input.payload ? toJsonValue(input.payload) : undefined,
        responseCode: input.responseCode ?? null,
        errorText: input.errorText ?? null,
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
}

export async function findRecentAlertByChecksum(
  subject: string,
  checksum: string,
  notOlderThan: Date,
): Promise<{ id: string; alertId: string; createdAt: Date } | null> {
  return watchtowerPrisma.trustAlertRecord.findFirst({
    where: {
      subject,
      checksum,
      createdAt: {
        gte: notOlderThan,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      alertId: true,
      createdAt: true,
    },
  });
}

export async function loadLatestSourceSnapshots(npi: string): Promise<readonly LatestSourceRecordRow[]> {
  const rows = await watchtowerPrisma.sourceRecord.findMany({
    where: { subjectNpi: npi },
    orderBy: [{ observedAt: 'desc' }, { fetchedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const latestBySource = new Map<string, LatestSourceRecordRow>();
  for (const row of rows) {
    if (!latestBySource.has(row.sourceId)) {
      latestBySource.set(row.sourceId, row);
    }
  }

  return Object.freeze([...latestBySource.values()]);
}

export async function loadWatchtowerStateForNpi(npi: string): Promise<{
  entityChangeEvents: readonly Record<string, unknown>[];
  sourceStalenessEvents: readonly Record<string, unknown>[];
  trustDegradationEvents: readonly Record<string, unknown>[];
  watchlistHits: readonly Record<string, unknown>[];
  alerts: readonly Record<string, unknown>[];
  deliveryAttempts: readonly Record<string, unknown>[];
}> {
  const [
    entityChangeEvents,
    sourceStalenessEvents,
    trustDegradationEvents,
    watchlistHits,
    alerts,
    deliveryAttemptsRaw,
  ] = await Promise.all([
    watchtowerPrisma.entityChangeEvent.findMany({
      where: { subjectNpi: npi },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    watchtowerPrisma.sourceStalenessEvent.findMany({
      where: { subjectNpi: npi },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    watchtowerPrisma.trustDegradationEvent.findMany({
      where: { subjectNpi: npi },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    watchtowerPrisma.watchlistHit.findMany({
      where: { subjectNpi: npi },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    watchtowerPrisma.trustAlertRecord.findMany({
      where: { subject: npi },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    watchtowerPrisma.alertDeliveryAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const deliveryAttempts = deliveryAttemptsRaw.filter((row) => {
    const payload = (row as { payload?: Prisma.JsonValue }).payload;
    const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
    return payloadObject?.subject === npi;
  });

  return {
    entityChangeEvents,
    sourceStalenessEvents,
    trustDegradationEvents,
    watchlistHits,
    alerts,
    deliveryAttempts,
  };
}

export function checksumForAlertGroup(input: {
  subject: string;
  type: string;
  sourceId?: string | null;
  claimType?: string | null;
  fieldPath?: string | null;
  currentValue?: unknown;
}): string {
  return stableHash({
    subject: input.subject,
    type: input.type,
    sourceId: input.sourceId ?? null,
    claimType: input.claimType ?? null,
    fieldPath: input.fieldPath ?? null,
    currentValue: input.currentValue ?? null,
  });
}
