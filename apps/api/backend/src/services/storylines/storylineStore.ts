import prisma, { Prisma } from '../../graphql/prisma_client';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2002'
  );
}

async function createWithDedup<T>(operation: () => Promise<T>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
}

export type StorylineTypeRecord =
  | 'TRUST_DECLINE'
  | 'RISING_INVESTIGATOR'
  | 'NETWORK_EMERGENCE'
  | 'COMPLIANCE_RISK'
  | 'WORKFORCE_OPPORTUNITY'
  | 'INSTITUTION_SHIFT'
  | 'INDUSTRY_INFLUENCE';

export type StorylinePerspectiveRecord = 'PROVIDER' | 'INSTITUTION' | 'NETWORK';
export type StorylineSeverityRecord = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type StorylineStatusRecord = 'ACTIVE' | 'QUIET' | 'ESCALATED' | 'RESOLVED' | 'ARCHIVED';
export type StorylineEntityTypeRecord = 'PROVIDER' | 'INSTITUTION' | 'NETWORK' | 'GENERIC';
export type StorylineEventTypeRecord =
  | 'ORIGIN'
  | 'UPDATED'
  | 'QUIET_PERIOD'
  | 'REACTIVATED'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'ARCHIVED'
  | 'ACKNOWLEDGED';
export type StorylineActionTypeRecord =
  | 'ACKNOWLEDGE'
  | 'ESCALATE'
  | 'ARCHIVE'
  | 'SAVE_INVESTIGATION';

export type StorylineRecordRow = Readonly<{
  id: string;
  storylineId: string;
  fingerprint: string;
  storylineType: StorylineTypeRecord;
  perspective: StorylinePerspectiveRecord;
  title: string;
  summary: string;
  whyItMatters: string;
  severity: StorylineSeverityRecord;
  confidence: number;
  entityIds: string[];
  findingIds: string[];
  supportingEvidence: Prisma.JsonValue | null;
  recommendedActions: Prisma.JsonValue | null;
  progressionScore: number;
  noveltyScore: number;
  persistenceScore: number;
  escalationThreshold: number;
  lastActivityAt: Date;
  status: StorylineStatusRecord;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  findingLinks?: StorylineFindingLinkRow[];
  entityLinks?: StorylineEntityLinkRow[];
  statusEvents?: StorylineStatusEventRow[];
  actionEvents?: StorylineActionEventRow[];
}>;

export type StorylineFindingLinkRow = Readonly<{
  id: string;
  storylineRefId: string;
  findingId: string;
  findingCategory: string;
  findingSeverity: StorylineSeverityRecord;
  observedAt: Date;
  weight: number;
  snapshot: Prisma.JsonValue | null;
  createdAt: Date;
}>;

export type StorylineEntityLinkRow = Readonly<{
  id: string;
  storylineRefId: string;
  entityType: StorylineEntityTypeRecord;
  entityKey: string;
  entityLabel: string | null;
  weight: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type StorylineStatusEventRow = Readonly<{
  id: string;
  storylineRefId: string;
  eventKey: string;
  eventType: StorylineEventTypeRecord;
  summary: string;
  fromStatus: StorylineStatusRecord | null;
  toStatus: StorylineStatusRecord | null;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
}>;

export type StorylineActionEventRow = Readonly<{
  id: string;
  storylineRefId: string;
  eventKey: string;
  actionType: StorylineActionTypeRecord;
  actorId: string | null;
  note: string | null;
  payload: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
}>;

export interface PersistStorylineInput {
  storyline: {
    storylineId: string;
    fingerprint: string;
    storylineType: StorylineTypeRecord;
    perspective: StorylinePerspectiveRecord;
    title: string;
    summary: string;
    whyItMatters: string;
    severity: StorylineSeverityRecord;
    confidence: number;
    entityIds: string[];
    findingIds: string[];
    supportingEvidence: unknown[];
    recommendedActions: string[];
    progressionScore: number;
    noveltyScore: number;
    persistenceScore: number;
    escalationThreshold: number;
    lastActivityAt: string;
    status: StorylineStatusRecord;
    metadata: Record<string, unknown>;
    createdAt?: string;
  };
  findingLinks?: Array<{
    findingId: string;
    findingCategory: string;
    findingSeverity: StorylineSeverityRecord;
    observedAt: string;
    weight: number;
    snapshot: Record<string, unknown>;
  }>;
  entityLinks?: Array<{
    entityType: StorylineEntityTypeRecord;
    entityKey: string;
    entityLabel?: string | null;
    weight: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
  statusEvents?: Array<{
    eventKey: string;
    eventType: StorylineEventTypeRecord;
    summary: string;
    fromStatus?: StorylineStatusRecord;
    toStatus?: StorylineStatusRecord;
    metadata?: Record<string, unknown>;
    occurredAt: string;
  }>;
}

export interface StorylineActionMutationInput {
  storylineId: string;
  nextStatus?: StorylineStatusRecord;
  statusEvent?: {
    eventKey: string;
    eventType: StorylineEventTypeRecord;
    summary: string;
    fromStatus?: StorylineStatusRecord;
    toStatus?: StorylineStatusRecord;
    metadata?: Record<string, unknown>;
    occurredAt: string;
  };
  actionEvent: {
    eventKey: string;
    actionType: StorylineActionTypeRecord;
    actorId?: string;
    note?: string;
    payload?: Record<string, unknown>;
    occurredAt: string;
  };
  patch?: Partial<{
    progressionScore: number;
    noveltyScore: number;
    persistenceScore: number;
    escalationThreshold: number;
    metadata: Record<string, unknown>;
  }>;
}

type StorylineStorePrismaClient = {
  storyline: {
    count(args: Record<string, unknown>): Promise<number>;
    findMany(args: Record<string, unknown>): Promise<StorylineRecordRow[]>;
    findUnique(args: Record<string, unknown>): Promise<StorylineRecordRow | null>;
    upsert(args: Record<string, unknown>): Promise<StorylineRecordRow>;
    update(args: Record<string, unknown>): Promise<StorylineRecordRow>;
  };
  storylineFindingLink: {
    deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
    createMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  storylineEntityLink: {
    deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
    createMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  storylineStatusEvent: {
    create(args: Record<string, unknown>): Promise<StorylineStatusEventRow>;
  };
  storylineActionEvent: {
    create(args: Record<string, unknown>): Promise<StorylineActionEventRow>;
  };
};

const storylinePrisma = prisma as unknown as StorylineStorePrismaClient;

const DETAIL_INCLUDE = {
  findingLinks: { orderBy: { observedAt: 'desc' } },
  entityLinks: { orderBy: [{ entityType: 'asc' }, { entityKey: 'asc' }] },
  statusEvents: { orderBy: { occurredAt: 'asc' } },
  actionEvents: { orderBy: { occurredAt: 'asc' } },
};

async function hydrateStorylineByInternalId(
  store: StorylineStorePrismaClient,
  id: string,
): Promise<StorylineRecordRow | null> {
  return store.storyline.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
}

function buildStorylineWhere(options?: {
  storylineType?: StorylineTypeRecord;
  severity?: StorylineSeverityRecord;
  status?: StorylineStatusRecord;
  perspective?: StorylinePerspectiveRecord;
  provider?: string;
  institution?: string;
  dateFrom?: string;
  dateTo?: string;
}): Prisma.StorylineWhereInput {
  return {
    ...(options?.storylineType ? { storylineType: options.storylineType } : {}),
    ...(options?.severity ? { severity: options.severity } : {}),
    ...(options?.status ? { status: options.status } : {}),
    ...(options?.perspective ? { perspective: options.perspective } : {}),
    ...(options?.dateFrom || options?.dateTo
      ? {
          lastActivityAt: {
            ...(options.dateFrom ? { gte: new Date(options.dateFrom) } : {}),
            ...(options.dateTo ? { lte: new Date(options.dateTo) } : {}),
          },
        }
      : {}),
    ...(options?.provider
      ? {
          entityLinks: {
            some: {
              entityType: 'PROVIDER',
              entityKey: options.provider,
            },
          },
        }
      : {}),
    ...(options?.institution
      ? {
          entityLinks: {
            some: {
              entityType: 'INSTITUTION',
              entityKey: options.institution,
            },
          },
        }
      : {}),
  };
}

export async function listStorylineRecords(options?: {
  storylineType?: StorylineTypeRecord;
  severity?: StorylineSeverityRecord;
  status?: StorylineStatusRecord;
  perspective?: StorylinePerspectiveRecord;
  provider?: string;
  institution?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDetails?: boolean;
  limit?: number;
}): Promise<StorylineRecordRow[]> {
  const where = buildStorylineWhere(options);
  const include = options?.includeDetails
    ? DETAIL_INCLUDE
    : {
        statusEvents: { orderBy: { occurredAt: 'asc' } },
      };

  return storylinePrisma.storyline.findMany({
    where,
    include,
    orderBy: [{ updatedAt: 'desc' }],
    take: options?.limit ?? 50,
  });
}

export async function countStorylineRecords(options?: {
  storylineType?: StorylineTypeRecord;
  severity?: StorylineSeverityRecord;
  status?: StorylineStatusRecord;
  perspective?: StorylinePerspectiveRecord;
  provider?: string;
  institution?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<number> {
  return storylinePrisma.storyline.count({
    where: buildStorylineWhere(options),
  });
}

export async function getStorylineRecord(
  storylineId: string,
): Promise<StorylineRecordRow | null> {
  return storylinePrisma.storyline.findUnique({
    where: { storylineId },
    include: DETAIL_INCLUDE,
  });
}

export async function upsertStorylineRecord(
  input: PersistStorylineInput,
): Promise<StorylineRecordRow> {
  return prisma.$transaction(async (transaction) => {
    const store = transaction as unknown as StorylineStorePrismaClient;
    const record = await store.storyline.upsert({
      where: { fingerprint: input.storyline.fingerprint },
      create: {
        storylineId: input.storyline.storylineId,
        fingerprint: input.storyline.fingerprint,
        storylineType: input.storyline.storylineType,
        perspective: input.storyline.perspective,
        title: input.storyline.title,
        summary: input.storyline.summary,
        whyItMatters: input.storyline.whyItMatters,
        severity: input.storyline.severity,
        confidence: input.storyline.confidence,
        entityIds: input.storyline.entityIds,
        findingIds: input.storyline.findingIds,
        supportingEvidence: toJsonValue(input.storyline.supportingEvidence),
        recommendedActions: toJsonValue(input.storyline.recommendedActions),
        progressionScore: input.storyline.progressionScore,
        noveltyScore: input.storyline.noveltyScore,
        persistenceScore: input.storyline.persistenceScore,
        escalationThreshold: input.storyline.escalationThreshold,
        lastActivityAt: new Date(input.storyline.lastActivityAt),
        status: input.storyline.status,
        metadata: toJsonValue(input.storyline.metadata),
        createdAt: input.storyline.createdAt ? new Date(input.storyline.createdAt) : undefined,
      },
      update: {
        storylineId: input.storyline.storylineId,
        title: input.storyline.title,
        summary: input.storyline.summary,
        whyItMatters: input.storyline.whyItMatters,
        severity: input.storyline.severity,
        confidence: input.storyline.confidence,
        entityIds: input.storyline.entityIds,
        findingIds: input.storyline.findingIds,
        supportingEvidence: toJsonValue(input.storyline.supportingEvidence),
        recommendedActions: toJsonValue(input.storyline.recommendedActions),
        progressionScore: input.storyline.progressionScore,
        noveltyScore: input.storyline.noveltyScore,
        persistenceScore: input.storyline.persistenceScore,
        escalationThreshold: input.storyline.escalationThreshold,
        lastActivityAt: new Date(input.storyline.lastActivityAt),
        status: input.storyline.status,
        metadata: toJsonValue(input.storyline.metadata),
      },
    });

    if (input.findingLinks) {
      await store.storylineFindingLink.deleteMany({
        where: { storylineRefId: record.id },
      });
      if (input.findingLinks.length > 0) {
        await store.storylineFindingLink.createMany({
          data: input.findingLinks.map((link) => ({
            storylineRefId: record.id,
            findingId: link.findingId,
            findingCategory: link.findingCategory,
            findingSeverity: link.findingSeverity,
            observedAt: new Date(link.observedAt),
            weight: link.weight,
            snapshot: toJsonValue(link.snapshot),
          })),
        });
      }
    }

    if (input.entityLinks) {
      await store.storylineEntityLink.deleteMany({
        where: { storylineRefId: record.id },
      });
      if (input.entityLinks.length > 0) {
        await store.storylineEntityLink.createMany({
          data: input.entityLinks.map((link) => ({
            storylineRefId: record.id,
            entityType: link.entityType,
            entityKey: link.entityKey,
            entityLabel: link.entityLabel ?? null,
            weight: link.weight,
            firstSeenAt: new Date(link.firstSeenAt),
            lastSeenAt: new Date(link.lastSeenAt),
          })),
        });
      }
    }

    for (const event of input.statusEvents ?? []) {
      await createWithDedup(() => store.storylineStatusEvent.create({
        data: {
          storylineRefId: record.id,
          eventKey: event.eventKey,
          eventType: event.eventType,
          summary: event.summary,
          fromStatus: event.fromStatus ?? null,
          toStatus: event.toStatus ?? null,
          metadata: event.metadata ? toJsonValue(event.metadata) : undefined,
          occurredAt: new Date(event.occurredAt),
        },
      }));
    }

    return (await hydrateStorylineByInternalId(store, record.id))!;
  });
}

export async function mutateStorylineRecord(
  input: StorylineActionMutationInput,
): Promise<StorylineRecordRow | null> {
  return prisma.$transaction(async (transaction) => {
    const store = transaction as unknown as StorylineStorePrismaClient;
    const current = await store.storyline.findUnique({
      where: { storylineId: input.storylineId },
    });
    if (!current) {
      return null;
    }

    const updated = await store.storyline.update({
      where: { id: current.id },
      data: {
        lastActivityAt: new Date(input.actionEvent.occurredAt),
        ...(input.nextStatus ? { status: input.nextStatus } : {}),
        ...(typeof input.patch?.progressionScore === 'number' ? { progressionScore: input.patch.progressionScore } : {}),
        ...(typeof input.patch?.noveltyScore === 'number' ? { noveltyScore: input.patch.noveltyScore } : {}),
        ...(typeof input.patch?.persistenceScore === 'number' ? { persistenceScore: input.patch.persistenceScore } : {}),
        ...(typeof input.patch?.escalationThreshold === 'number' ? { escalationThreshold: input.patch.escalationThreshold } : {}),
        ...(input.patch?.metadata ? { metadata: toJsonValue(input.patch.metadata) } : {}),
      },
    });

    const statusEvent = input.statusEvent;
    if (statusEvent) {
      await createWithDedup(() => store.storylineStatusEvent.create({
        data: {
          storylineRefId: current.id,
          eventKey: statusEvent.eventKey,
          eventType: statusEvent.eventType,
          summary: statusEvent.summary,
          fromStatus: statusEvent.fromStatus ?? null,
          toStatus: statusEvent.toStatus ?? null,
          metadata: statusEvent.metadata ? toJsonValue(statusEvent.metadata) : undefined,
          occurredAt: new Date(statusEvent.occurredAt),
        },
      }));
    }

    await createWithDedup(() => store.storylineActionEvent.create({
      data: {
        storylineRefId: current.id,
        eventKey: input.actionEvent.eventKey,
        actionType: input.actionEvent.actionType,
        actorId: input.actionEvent.actorId ?? null,
        note: input.actionEvent.note ?? null,
        payload: input.actionEvent.payload ? toJsonValue(input.actionEvent.payload) : undefined,
        occurredAt: new Date(input.actionEvent.occurredAt),
      },
    }));

    return hydrateStorylineByInternalId(store, updated.id);
  });
}
