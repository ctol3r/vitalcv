import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Prisma } from '@prisma/client';
import type {
  FindingStore,
  FindingStorePersistInput,
  FindingStorePersistResult,
  FindingStoreQuery,
} from '../../../../../../core/investigators/findingStore';
import { createInvestigatorEngine } from '../../../../../../core/investigators/investigatorEngine';
import { normalizeInvestigatorFindingStatus } from '../../../../../../core/investigators/investigatorTypes';
import type {
  FindingEntityLink,
  FindingEvidence,
  InvestigatorFindingDetail,
  InvestigatorFindingRecord,
  InvestigatorFindingStatus,
  InvestigatorFindingStatusInput,
} from '../../../../../../core/investigators/investigatorTypes';
import { publish } from '../../core/events/eventBus';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { publishMany } from '../investigation/findingsBus';
import { buildDefaultInvestigators, type BackendInvestigatorDependencies } from './defaultInvestigators';

const investigatorTracer = trace.getTracer('vitalcv.investigators');
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

type PrismaFindingRow = Awaited<ReturnType<typeof prisma.investigatorFinding.findFirst>>;
type PrismaEntityLinkRow = {
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  relationship: string | null;
  metadata: Prisma.JsonValue;
};
type PrismaStatusEventRow = {
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  note: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
};
type PrismaFindingDetailRow = NonNullable<PrismaFindingRow> & {
  entityLinks: PrismaEntityLinkRow[];
  statusEvents: PrismaStatusEventRow[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asEvidenceList(value: unknown): FindingEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, index) => {
    const record = asRecord(entry);
    return {
      evidenceId: typeof record.evidenceId === 'string' ? record.evidenceId : `evidence_${index}`,
      evidenceType: typeof record.evidenceType === 'string' ? record.evidenceType : 'unknown',
      sourceId: typeof record.sourceId === 'string' ? record.sourceId : null,
      sourceLabel: typeof record.sourceLabel === 'string' ? record.sourceLabel : null,
      recordType: typeof record.recordType === 'string' ? record.recordType : null,
      recordId: typeof record.recordId === 'string' ? record.recordId : null,
      url: typeof record.url === 'string' ? record.url : null,
      snippet: typeof record.snippet === 'string' ? record.snippet : null,
      observedAt: typeof record.observedAt === 'string' ? record.observedAt : null,
      metadata: asRecord(record.metadata),
    };
  });
}

function findingRecordFromRow(
  row: NonNullable<PrismaFindingRow> & { entityLinks?: PrismaEntityLinkRow[] },
): InvestigatorFindingRecord {
  return {
    findingId: row.findingId,
    investigatorId: row.investigatorId,
    findingType: row.findingType,
    scope: row.scope as InvestigatorFindingRecord['scope'],
    severity: row.severity as InvestigatorFindingRecord['severity'],
    title: row.title,
    summary: row.summary,
    entityIds: [...row.entityIds],
    entities: row.entityLinks?.map((entity): FindingEntityLink => ({
      entityType: entity.entityType,
      entityId: entity.entityId,
      entityLabel: entity.entityLabel,
      relationship: entity.relationship,
      metadata: asRecord(entity.metadata),
    })) ?? [],
    supportingEvidence: asEvidenceList(row.supportingEvidence),
    confidence: row.confidence,
    explanation: row.explanation,
    status: normalizeInvestigatorFindingStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    occurrenceCount: row.occurrenceCount,
    priorityScore: row.priorityScore,
    scoreSignals: {
      confidence: row.confidence,
      trustImpact: row.trustImpact,
      freshness: row.freshness,
      novelty: row.novelty,
      entityImportance: row.entityImportance,
      graphCentrality: row.graphCentrality,
    },
    rankBreakdown: {
      severity: Number(asRecord(row.rankBreakdown).severity ?? 0),
      confidence: Number(asRecord(row.rankBreakdown).confidence ?? 0),
      trustImpact: Number(asRecord(row.rankBreakdown).trustImpact ?? 0),
      freshness: Number(asRecord(row.rankBreakdown).freshness ?? 0),
      novelty: Number(asRecord(row.rankBreakdown).novelty ?? 0),
      entityImportance: Number(asRecord(row.rankBreakdown).entityImportance ?? 0),
      graphCentrality: Number(asRecord(row.rankBreakdown).graphCentrality ?? 0),
      total: Number(asRecord(row.rankBreakdown).total ?? 0),
      weights: (asRecord(asRecord(row.rankBreakdown).weights) as InvestigatorFindingRecord['rankBreakdown']['weights']),
    },
    audienceRoles: [...row.audienceRoles] as InvestigatorFindingRecord['audienceRoles'],
    metadata: asRecord(row.metadata),
    dedupeKey: row.dedupeKey,
    storylineKey: row.storylineKey,
  };
}

function detailFromRow(row: PrismaFindingDetailRow): InvestigatorFindingDetail {
  const base = findingRecordFromRow(row);
  return {
    ...base,
    entities: row.entityLinks.map((entity): FindingEntityLink => ({
      entityType: entity.entityType,
      entityId: entity.entityId,
      entityLabel: entity.entityLabel,
      relationship: entity.relationship,
      metadata: asRecord(entity.metadata),
    })),
    statusEvents: row.statusEvents.map((event) => ({
      fromStatus: event.fromStatus ? normalizeInvestigatorFindingStatus(event.fromStatus) : null,
      toStatus: normalizeInvestigatorFindingStatus(event.toStatus),
      actorId: event.actorId,
      note: event.note,
      metadata: asRecord(event.metadata),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function findingCreateData(finding: InvestigatorFindingRecord): Prisma.InvestigatorFindingCreateInput {
  return {
    findingId: finding.findingId,
    investigatorId: finding.investigatorId,
    findingType: finding.findingType,
    scope: finding.scope,
    severity: finding.severity,
    status: finding.status,
    title: finding.title,
    summary: finding.summary,
    explanation: finding.explanation,
    confidence: finding.confidence,
    priorityScore: finding.priorityScore,
    trustImpact: finding.scoreSignals.trustImpact,
    freshness: finding.scoreSignals.freshness,
    novelty: finding.scoreSignals.novelty,
    entityImportance: finding.scoreSignals.entityImportance,
    graphCentrality: finding.scoreSignals.graphCentrality,
    entityIds: finding.entityIds,
    audienceRoles: finding.audienceRoles,
    supportingEvidence: toJsonValue(finding.supportingEvidence),
    rankBreakdown: toJsonValue(finding.rankBreakdown),
    metadata: toJsonValue(finding.metadata),
    storylineKey: finding.storylineKey,
    dedupeKey: finding.dedupeKey,
    firstSeenAt: new Date(finding.firstSeenAt),
    lastSeenAt: new Date(finding.lastSeenAt),
    occurrenceCount: finding.occurrenceCount,
    createdAt: new Date(finding.createdAt),
    updatedAt: new Date(finding.updatedAt),
    evidenceLinks: {
      create: finding.supportingEvidence.map((evidence) => ({
        evidenceId: evidence.evidenceId,
        evidenceType: evidence.evidenceType,
        sourceId: evidence.sourceId ?? null,
        sourceLabel: evidence.sourceLabel ?? null,
        recordType: evidence.recordType ?? null,
        recordId: evidence.recordId ?? null,
        url: evidence.url ?? null,
        snippet: evidence.snippet ?? null,
        observedAt: evidence.observedAt ? new Date(evidence.observedAt) : null,
        metadata: (evidence.metadata ?? {}) as Prisma.InputJsonValue,
      })),
    },
    entityLinks: {
      create: finding.entities.map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityLabel: entity.entityLabel ?? null,
        relationship: entity.relationship ?? null,
        metadata: (entity.metadata ?? {}) as Prisma.InputJsonValue,
      })),
    },
    statusEvents: {
      create: [{
        fromStatus: null,
        toStatus: finding.status,
        note: 'Finding created by investigator run.',
        metadata: {},
      }],
    },
  };
}

class PrismaFindingStore implements FindingStore {
  constructor(private readonly prismaClient = prisma) {}

  async beginRun(input: {
    runId: string;
    investigatorId: string;
    trigger: string;
    scope: string;
    entityType: string | null;
    targetEntityIds: string[];
    startedAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prismaClient.investigatorRunLog.create({
      data: {
        runId: input.runId,
        investigatorId: input.investigatorId,
        trigger: input.trigger,
        scope: input.scope,
        entityType: input.entityType ?? null,
        targetEntityIds: input.targetEntityIds,
        startedAt: new Date(input.startedAt),
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async finishRun(input: {
    runId: string;
    status: 'succeeded' | 'failed';
    completedAt: string;
    durationMs: number;
    entitiesScanned: number;
    findingsGenerated: number;
    findingsCreated: number;
    findingsUpdated: number;
    findingsResolved: number;
    findingsSuppressed: number;
    storylinesMerged: number;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const updatedRun = await this.prismaClient.investigatorRunLog.update({
      where: { runId: input.runId },
      data: {
        status: input.status,
        completedAt: new Date(input.completedAt),
        durationMs: input.durationMs,
        entitiesScanned: input.entitiesScanned,
        findingsGenerated: input.findingsGenerated,
        findingsCreated: input.findingsCreated,
        findingsUpdated: input.findingsUpdated,
        findingsResolved: input.findingsResolved,
        findingsSuppressed: input.findingsSuppressed,
        storylinesMerged: input.storylinesMerged,
        errorMessage: input.errorMessage ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await publish({
      type: 'INVESTIGATOR_RUN_COMPLETE',
      payload: {
        runId: updatedRun.runId,
        investigatorId: updatedRun.investigatorId,
        trigger: updatedRun.trigger,
        status: input.status,
        entityType: updatedRun.entityType ?? null,
        targetEntityIds: [...updatedRun.targetEntityIds],
        startedAt: updatedRun.startedAt.toISOString(),
        completedAt: input.completedAt,
        durationMs: input.durationMs,
        entitiesScanned: input.entitiesScanned,
        findingsGenerated: input.findingsGenerated,
        findingsCreated: input.findingsCreated,
        findingsUpdated: input.findingsUpdated,
        findingsResolved: input.findingsResolved,
        findingsSuppressed: input.findingsSuppressed,
        storylinesMerged: input.storylinesMerged,
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  async getLastRunStartedAt(investigatorIds?: string[]): Promise<Record<string, string>> {
    const rows = await this.prismaClient.investigatorRunLog.findMany({
      where: investigatorIds && investigatorIds.length > 0
        ? { investigatorId: { in: investigatorIds } }
        : undefined,
      orderBy: { startedAt: 'desc' },
      select: {
        investigatorId: true,
        startedAt: true,
      },
      take: Math.max(50, (investigatorIds?.length ?? 0) * 4),
    });

    const results: Record<string, string> = {};
    for (const row of rows) {
      if (!results[row.investigatorId]) {
        results[row.investigatorId] = row.startedAt.toISOString();
      }
    }

    return results;
  }

  async loadByDedupeKeys(dedupeKeys: string[]): Promise<InvestigatorFindingRecord[]> {
    if (dedupeKeys.length === 0) {
      return [];
    }

    const rows = await this.prismaClient.investigatorFinding.findMany({
      where: { dedupeKey: { in: dedupeKeys } },
    });
    return rows.map((row) => findingRecordFromRow(row));
  }

  async persistFindings<TDependencies = Record<string, never>>(
    input: FindingStorePersistInput<TDependencies>,
  ): Promise<FindingStorePersistResult> {
    if (input.findings.length === 0) {
      return { findingsCreated: 0, findingsUpdated: 0, persistedFindings: [] };
    }

    const existingRows = await this.prismaClient.investigatorFinding.findMany({
      where: { dedupeKey: { in: input.findings.map((finding) => finding.dedupeKey) } },
      include: {
        evidenceLinks: true,
        entityLinks: true,
        statusEvents: true,
      },
    });
    const existingByDedupeKey = new Map(existingRows.map((row) => [row.dedupeKey, row]));

    let findingsCreated = 0;
    let findingsUpdated = 0;
    const persistedFindings: InvestigatorFindingRecord[] = [];

    for (const finding of input.findings) {
      const existing = existingByDedupeKey.get(finding.dedupeKey);
      if (!existing) {
        findingsCreated += 1;
        const created = await this.prismaClient.investigatorFinding.create({
          data: findingCreateData(finding),
        });
        const persistedFinding = findingRecordFromRow(created);
        persistedFindings.push(persistedFinding);
        await publish({
          type: 'FINDING_CREATED',
          payload: {
            runId: input.runId,
            findingId: persistedFinding.findingId,
            investigatorId: persistedFinding.investigatorId,
            severity: persistedFinding.severity,
            status: persistedFinding.status,
            entityIds: [...persistedFinding.entityIds],
            storylineKey: persistedFinding.storylineKey,
            operation: 'created',
          },
        });
        continue;
      }

      findingsUpdated += 1;
      const existingStatus = normalizeInvestigatorFindingStatus(existing.status);
      const statusChanged = existingStatus !== finding.status;
      const updated = await this.prismaClient.investigatorFinding.update({
        where: { dedupeKey: finding.dedupeKey },
        data: {
          investigatorId: finding.investigatorId,
          findingType: finding.findingType,
          scope: finding.scope,
          severity: finding.severity,
          status: finding.status,
          title: finding.title,
          summary: finding.summary,
          explanation: finding.explanation,
          confidence: finding.confidence,
          priorityScore: finding.priorityScore,
          trustImpact: finding.scoreSignals.trustImpact,
          freshness: finding.scoreSignals.freshness,
          novelty: finding.scoreSignals.novelty,
          entityImportance: finding.scoreSignals.entityImportance,
          graphCentrality: finding.scoreSignals.graphCentrality,
          entityIds: finding.entityIds,
          audienceRoles: finding.audienceRoles,
          supportingEvidence: toJsonValue(finding.supportingEvidence),
          rankBreakdown: toJsonValue(finding.rankBreakdown),
          metadata: toJsonValue(finding.metadata),
          storylineKey: finding.storylineKey,
          lastSeenAt: new Date(finding.lastSeenAt),
          occurrenceCount: finding.occurrenceCount,
          evidenceLinks: {
            deleteMany: {},
            create: finding.supportingEvidence.map((evidence) => ({
              evidenceId: evidence.evidenceId,
              evidenceType: evidence.evidenceType,
              sourceId: evidence.sourceId ?? null,
              sourceLabel: evidence.sourceLabel ?? null,
              recordType: evidence.recordType ?? null,
              recordId: evidence.recordId ?? null,
              url: evidence.url ?? null,
              snippet: evidence.snippet ?? null,
              observedAt: evidence.observedAt ? new Date(evidence.observedAt) : null,
              metadata: (evidence.metadata ?? {}) as Prisma.InputJsonValue,
            })),
          },
          entityLinks: {
            deleteMany: {},
            create: finding.entities.map((entity) => ({
              entityType: entity.entityType,
              entityId: entity.entityId,
              entityLabel: entity.entityLabel ?? null,
              relationship: entity.relationship ?? null,
              metadata: (entity.metadata ?? {}) as Prisma.InputJsonValue,
            })),
          },
          statusEvents: statusChanged
            ? {
              create: [{
                fromStatus: existingStatus,
                toStatus: finding.status,
                note: 'Finding status reopened by investigator rerun.',
                metadata: {},
              }],
            }
            : undefined,
        },
      });
      const persistedFinding = findingRecordFromRow(updated);
      persistedFindings.push(persistedFinding);
      await publish({
        type: 'FINDING_CREATED',
        payload: {
          runId: input.runId,
          findingId: persistedFinding.findingId,
          investigatorId: persistedFinding.investigatorId,
          severity: persistedFinding.severity,
          status: persistedFinding.status,
          entityIds: [...persistedFinding.entityIds],
          storylineKey: persistedFinding.storylineKey,
          operation: 'updated',
        },
      });
    }

    return { findingsCreated, findingsUpdated, persistedFindings };
  }

  async resolveMissingFindings(input: {
    investigatorId: string;
    coveredEntityIds: string[];
    activeDedupeKeys: string[];
    resolvedAt: string;
    note?: string | null;
  }): Promise<number> {
    if (input.coveredEntityIds.length === 0) {
      return 0;
    }

    const rows = await this.prismaClient.investigatorFinding.findMany({
      where: {
        investigatorId: input.investigatorId,
        status: { in: ['new', 'acknowledged', 'investigating', 'escalated'] },
        entityIds: { hasSome: input.coveredEntityIds },
        dedupeKey: input.activeDedupeKeys.length > 0 ? { notIn: input.activeDedupeKeys } : undefined,
      },
      select: {
        id: true,
        status: true,
      },
    });

    for (const row of rows) {
      await this.prismaClient.investigatorFinding.update({
        where: { id: row.id },
        data: {
          status: 'resolved',
          statusEvents: {
            create: [{
              fromStatus: row.status,
              toStatus: 'resolved',
              note: input.note ?? 'Signal not reproduced in the latest investigator run.',
              metadata: {},
            }],
          },
        },
      });
    }

    return rows.length;
  }

  async listFindings(query: FindingStoreQuery): Promise<{ total: number; findings: InvestigatorFindingRecord[] }> {
    const where = buildFindingWhere(query);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const [total, rows] = await Promise.all([
      this.prismaClient.investigatorFinding.count({ where }),
      this.prismaClient.investigatorFinding.findMany({
        where,
        orderBy: [
          { priorityScore: 'desc' },
          { lastSeenAt: 'desc' },
        ],
        skip: offset,
        take: limit,
        include: {
          entityLinks: true,
        },
      }),
    ]);

    return {
      total,
      findings: rows.map((row) => findingRecordFromRow(row)),
    };
  }

  async getFinding(findingId: string): Promise<InvestigatorFindingDetail | null> {
    const row = await this.prismaClient.investigatorFinding.findUnique({
      where: { findingId },
      include: {
        evidenceLinks: true,
        entityLinks: true,
        statusEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return row ? detailFromRow(row) : null;
  }

  async updateStatus(input: {
    findingId: string;
    status: InvestigatorFindingStatus;
    actorId?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
    changedAt: string;
  }): Promise<InvestigatorFindingDetail> {
    const existing = await this.prismaClient.investigatorFinding.findUnique({
      where: { findingId: input.findingId },
      include: {
        evidenceLinks: true,
        entityLinks: true,
        statusEvents: true,
      },
    });

    if (!existing) {
      throw new Error(`Finding not found: ${input.findingId}`);
    }

    const updated = await this.prismaClient.investigatorFinding.update({
      where: { findingId: input.findingId },
      data: {
        status: input.status,
        statusEvents: {
          create: [{
            fromStatus: normalizeInvestigatorFindingStatus(existing.status),
            toStatus: input.status,
            actorId: input.actorId ?? null,
            note: input.note ?? null,
            metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
            createdAt: new Date(input.changedAt),
          }],
        },
      },
      include: {
        evidenceLinks: true,
        entityLinks: true,
        statusEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return detailFromRow(updated);
  }
}

function normalizeList(value: string[] | string | undefined): string[] {
  if (!value) {
    return [];
  }
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((entry) => entry.split(',')).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function parseDateBoundary(value: string | null | undefined, boundary: 'start' | 'end'): Date | null {
  if (!value) {
    return null;
  }

  if (DATE_ONLY_RE.test(value)) {
    const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildFindingWhere(query: FindingStoreQuery): Prisma.InvestigatorFindingWhereInput {
  const and: Prisma.InvestigatorFindingWhereInput[] = [];

  const severities = normalizeList(query.severity);
  if (severities.length > 0) {
    and.push({ severity: { in: severities } });
  }

  const types = normalizeList(query.findingType);
  if (types.length > 0) {
    and.push({ findingType: { in: types } });
  }

  const investigatorIds = normalizeList(query.investigatorId);
  if (investigatorIds.length > 0) {
    and.push({ investigatorId: { in: investigatorIds } });
  }

  const statuses = normalizeList(query.status);
  if (statuses.length > 0) {
    and.push({
      status: {
        in: [...new Set(statuses.flatMap((status) => {
          const normalized = normalizeInvestigatorFindingStatus(status);
          return normalized === 'investigating'
            ? ['investigating', 'escalated']
            : [normalized];
        }))],
      },
    });
  }

  const dateFrom = parseDateBoundary(query.dateFrom, 'start');
  const dateTo = parseDateBoundary(query.dateTo, 'end');
  if (dateFrom || dateTo) {
    and.push({
      updatedAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    });
  }

  if (typeof query.minConfidence === 'number' && Number.isFinite(query.minConfidence)) {
    and.push({
      confidence: {
        gte: Math.max(0, Math.min(query.minConfidence, 1)),
      },
    });
  }

  if (query.provider) {
    and.push({
      entityLinks: {
        some: {
          entityType: 'provider',
          OR: [
            { entityId: query.provider },
            { entityLabel: { contains: query.provider, mode: 'insensitive' } },
          ],
        },
      },
    });
  }

  if (query.institution) {
    and.push({
      entityLinks: {
        some: {
          entityType: 'institution',
          OR: [
            { entityId: query.institution },
            { entityLabel: { contains: query.institution, mode: 'insensitive' } },
          ],
        },
      },
    });
  }

  if (and.length === 0) {
    return {};
  }

  return { AND: and };
}

const store = new PrismaFindingStore(prisma);
const engine = createInvestigatorEngine<BackendInvestigatorDependencies>(buildDefaultInvestigators(), store);

async function withInvestigatorSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  return investigatorTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'investigator failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

function publishPersistedFindings(results: Array<{ persistedFindings: InvestigatorFindingRecord[] }>): void {
  const persistedFindings = results.flatMap((result) => result.persistedFindings);
  if (persistedFindings.length === 0) {
    return;
  }

  const publications = publishMany(persistedFindings);
  log('info', 'investigators: findings published', {
    published: publications.length,
    investigators: [...new Set(persistedFindings.map((finding) => finding.investigatorId))],
  });
}

export async function listInvestigatorFindings(query: FindingStoreQuery) {
  return engine.listFindings(query);
}

export async function getInvestigatorFinding(findingId: string) {
  return engine.getFinding(findingId);
}

export async function acknowledgeInvestigatorFinding(
  findingId: string,
  input: { actorId?: string | null; note?: string | null },
) {
  return setInvestigatorFindingStatus(findingId, 'acknowledged', input);
}

export async function dismissInvestigatorFinding(
  findingId: string,
  input: { actorId?: string | null; note?: string | null },
) {
  return setInvestigatorFindingStatus(findingId, 'dismissed', input);
}

export async function escalateInvestigatorFinding(
  findingId: string,
  input: { actorId?: string | null; note?: string | null },
) {
  return setInvestigatorFindingStatus(findingId, 'investigating', input);
}

export async function setInvestigatorFindingStatus(
  findingId: string,
  status: InvestigatorFindingStatusInput,
  input: { actorId?: string | null; note?: string | null; metadata?: Record<string, unknown> },
) {
  return engine.updateFindingStatus({
    findingId,
    status: normalizeInvestigatorFindingStatus(status),
    actorId: input.actorId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    changedAt: new Date().toISOString(),
  });
}

export async function runScheduledInvestigators(now = new Date().toISOString()) {
  return withInvestigatorSpan(
    'investigators.run_scheduled',
    { 'vitalcv.investigators.trigger': 'scheduled' },
    async () => {
      const results = await engine.runScheduled({
        now,
        dependencies: { prisma },
      });
      publishPersistedFindings(results);
      log('info', 'investigators: scheduled run complete', {
        investigatorsRun: results.length,
        findingsGenerated: results.reduce((sum, result) => sum + result.findingsGenerated, 0),
      });
      return results;
    },
  );
}

export async function runTargetedInvestigators(input: {
  entityType?: string | null;
  targetEntityIds: string[];
  investigatorIds?: string[];
  trigger?: 'targeted' | 'event_ingestion' | 'event_trust_change' | 'manual';
  metadata?: Record<string, unknown>;
}) {
  const trigger = input.trigger ?? 'targeted';
  return withInvestigatorSpan(
    'investigators.run_targeted',
    {
      'vitalcv.investigators.trigger': trigger,
      'vitalcv.investigators.targets': input.targetEntityIds.length,
    },
    async () => {
      const results = await engine.runTriggered({
        now: new Date().toISOString(),
        trigger,
        entityType: input.entityType ?? null,
        targetEntityIds: input.targetEntityIds,
        investigatorIds: input.investigatorIds,
        dependencies: { prisma },
        metadata: input.metadata,
      });
      publishPersistedFindings(results);
      return results;
    },
  );
}

export async function runInvestigatorEvent(input: {
  entityType?: string | null;
  targetEntityIds: string[];
  trigger: 'event_ingestion' | 'event_trust_change';
  metadata?: Record<string, unknown>;
}) {
  if (input.targetEntityIds.length === 0) {
    return [];
  }

  return runTargetedInvestigators({
    entityType: input.entityType ?? null,
    targetEntityIds: input.targetEntityIds,
    trigger: input.trigger,
    metadata: input.metadata,
  });
}
