import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type {
  IngestEventPayload,
  IngestEventType,
  IngestRunStatus,
  IngestSourceId,
  IngestSourceRunStatus,
  PersistedIngestEvent,
  PersistedIngestRun,
} from './contracts';
import { INGEST_SOURCE_IDS } from './contracts';

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

function toPersistedRun(row: {
  id: string;
  npi: string;
  status: string;
  entityId: string | null;
  lastError: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PersistedIngestRun {
  return {
    id: row.id,
    npi: row.npi,
    status: row.status as IngestRunStatus,
    entityId: row.entityId,
    lastError: row.lastError,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPersistedEvent(row: {
  id: string;
  ingestRunId: string;
  sequence: number;
  eventType: string;
  sourceId: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): PersistedIngestEvent {
  return {
    id: row.id,
    runId: row.ingestRunId,
    sequence: row.sequence,
    type: row.eventType as IngestEventType,
    sourceId: (row.sourceId ?? undefined) as IngestSourceId | undefined,
    timestamp: row.createdAt.toISOString(),
    payload: row.payload as IngestEventPayload,
  };
}

export async function findOpenIngestRunByNpi(
  npi: string,
): Promise<PersistedIngestRun | null> {
  const run = await prisma.ingestRun.findFirst({
    where: {
      npi,
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return run ? toPersistedRun(run) : null;
}

export async function createIngestRun(
  npi: string,
  sources: readonly IngestSourceId[] = INGEST_SOURCE_IDS,
): Promise<PersistedIngestRun> {
  const created = await prisma.$transaction(async (tx) => {
    const run = await tx.ingestRun.create({
      data: {
        npi,
        status: 'PENDING',
      },
    });

    await tx.ingestSourceRun.createMany({
      data: sources.map((sourceId) => ({
        ingestRunId: run.id,
        sourceId,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });

    return run;
  });

  return toPersistedRun(created);
}

export async function getOrCreateIngestRun(
  npi: string,
  sources: readonly IngestSourceId[] = INGEST_SOURCE_IDS,
): Promise<{ run: PersistedIngestRun; created: boolean }> {
  const existing = await findOpenIngestRunByNpi(npi);
  if (existing) {
    return { run: existing, created: false };
  }

  const created = await createIngestRun(npi, sources);
  return { run: created, created: true };
}

export async function getIngestRun(runId: string): Promise<PersistedIngestRun | null> {
  const run = await prisma.ingestRun.findUnique({
    where: { id: runId },
  });

  return run ? toPersistedRun(run) : null;
}

export async function updateIngestRun(
  runId: string,
  data: {
    status?: IngestRunStatus;
    entityId?: string | null;
    lastError?: string | null;
    startedAt?: Date;
    completedAt?: Date | null;
  },
): Promise<PersistedIngestRun> {
  const updated = await prisma.ingestRun.update({
    where: { id: runId },
    data,
  });

  return toPersistedRun(updated);
}

export async function startIngestRun(runId: string): Promise<PersistedIngestRun> {
  return updateIngestRun(runId, {
    status: 'RUNNING',
    startedAt: new Date(),
  });
}

export async function completeIngestRun(
  runId: string,
  data: {
    status: IngestRunStatus;
    entityId?: string | null;
    lastError?: string | null;
  },
): Promise<PersistedIngestRun> {
  return updateIngestRun(runId, {
    status: data.status,
    entityId: data.entityId,
    lastError: data.lastError ?? null,
    completedAt: new Date(),
  });
}

export async function updateIngestSourceRun(
  runId: string,
  sourceId: IngestSourceId,
  data: {
    status?: IngestSourceRunStatus;
    sourceRunId?: string | null;
    artifactId?: string | null;
    claimCount?: number;
    credentialCount?: number;
    errorCode?: string | null;
    lastError?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<void> {
  await prisma.ingestSourceRun.update({
    where: {
      ingestRunId_sourceId: {
        ingestRunId: runId,
        sourceId,
      },
    },
    data,
  });
}

export async function appendIngestEvent(input: {
  runId: string;
  type: IngestEventType;
  sourceId?: IngestSourceId;
  dedupeKey: string;
  payload: IngestEventPayload;
}): Promise<PersistedIngestEvent> {
  const attemptCreate = async (): Promise<PersistedIngestEvent> =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.ingestEvent.findFirst({
        where: {
          ingestRunId: input.runId,
          dedupeKey: input.dedupeKey,
        },
      });
      if (existing) {
        return toPersistedEvent(existing);
      }

      const lastEvent = await tx.ingestEvent.findFirst({
        where: { ingestRunId: input.runId },
        orderBy: { sequence: 'desc' },
      });
      const created = await tx.ingestEvent.create({
        data: {
          ingestRunId: input.runId,
          sequence: (lastEvent?.sequence ?? 0) + 1,
          eventType: input.type,
          sourceId: input.sourceId,
          dedupeKey: input.dedupeKey,
          payload: toJsonValue(input.payload),
        },
      });

      return toPersistedEvent(created);
    });

  try {
    return await attemptCreate();
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.ingestEvent.findFirstOrThrow({
      where: {
        ingestRunId: input.runId,
        dedupeKey: input.dedupeKey,
      },
    });
    return toPersistedEvent(existing);
  }
}

export async function listIngestEvents(
  runId: string,
  options?: { afterSequence?: number },
): Promise<PersistedIngestEvent[]> {
  const rows = await prisma.ingestEvent.findMany({
    where: {
      ingestRunId: runId,
      ...(options?.afterSequence
        ? { sequence: { gt: options.afterSequence } }
        : {}),
    },
    orderBy: { sequence: 'asc' },
  });

  return rows.map((row) => toPersistedEvent(row));
}

export async function getIngestSourceRunSummary(
  runId: string,
): Promise<Array<{
  sourceId: IngestSourceId;
  status: IngestSourceRunStatus;
  claimCount: number;
  credentialCount: number;
}>> {
  const rows = await prisma.ingestSourceRun.findMany({
    where: { ingestRunId: runId },
    select: {
      sourceId: true,
      status: true,
      claimCount: true,
      credentialCount: true,
    },
    orderBy: { sourceId: 'asc' },
  });

  return rows.map((row) => ({
    sourceId: row.sourceId as IngestSourceId,
    status: row.status as IngestSourceRunStatus,
    claimCount: row.claimCount,
    credentialCount: row.credentialCount,
  }));
}
