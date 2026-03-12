import prisma, { Prisma } from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { computeTrustState } from '../trustState';
import {
  evaluateRetentionWindows,
  getSourcePolicy,
  hashSensitiveInput,
  type AdapterQueryAuditRecord,
  type AdapterStatusSnapshot,
  type CanonicalCredentialFactStore,
  type CredentialFactBatch,
  type DisclosureAuditRecord,
  type PersistBatchInput,
  type PersistedBatchRecord,
} from '@vitalcv/psv-adapters';

type VerificationArtifactRecord = Readonly<{
  id: string;
  status: string;
  source: string;
  verifiedAt: Date;
}>;

type PrismaClientLike = {
  verificationArtifact: {
    findFirst(args: Record<string, unknown>): Promise<VerificationArtifactRecord | null>;
    findMany(args: Record<string, unknown>): Promise<VerificationArtifactRecord[]>;
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  auditEvent: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  monitoringEvent: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  nursysEvent: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toDateOrNull(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

function extractNursysRows(batch: CredentialFactBatch): Array<{
  npi: string;
  licenseNumber: string;
  state: string;
  eventType: string;
  rawPayload: Record<string, unknown>;
}> {
  if (batch.source !== 'nursys-enotify' || !batch.rawResponse || typeof batch.rawResponse !== 'object') {
    return [];
  }

  const response = batch.rawResponse as Record<string, unknown>;
  const candidates = Array.isArray(response.events)
    ? response.events
    : Array.isArray(response.data)
      ? response.data
      : response.event && typeof response.event === 'object'
        ? [response.event]
        : response.licenseNumber || response.license_number
          ? [response]
          : [];

  return candidates
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      npi: String(entry.npi ?? batch.subjectId),
      licenseNumber: String(entry.licenseNumber ?? entry.license_number ?? entry.license ?? ''),
      state: String(entry.state ?? entry.jurisdiction ?? '').toUpperCase(),
      eventType: String(entry.eventType ?? entry.type ?? 'LICENSE_UPDATED').toUpperCase(),
      rawPayload: entry,
    }))
    .filter((entry) => entry.licenseNumber.length > 0 && entry.state.length > 0);
}

function trustStateForBatch(batch: CredentialFactBatch): string {
  return computeTrustState({
    status: batch.summary.status,
    expiresAt: toDateOrNull(batch.summary.expiresAt),
    monitoring: Boolean(batch.summary.monitoringEnabled),
  });
}

export class BackendCanonicalCredentialFactStore implements CanonicalCredentialFactStore {
  constructor(private readonly prismaClient: PrismaClientLike = prisma as unknown as PrismaClientLike) {}

  async persistBatch(input: PersistBatchInput): Promise<PersistedBatchRecord> {
    const existing = await this.prismaClient.verificationArtifact.findFirst({
      where: {
        npi: input.batch.subjectId,
        source: input.batch.source,
        checksum: input.batch.rawResponseHash,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existing) {
      return Object.freeze({
        artifactId: existing.id,
        idempotent: true,
        status: input.batch.summary.status,
        factCount: input.batch.facts.length,
        eventCount: input.batch.events.length,
      });
    }

    const previous = await this.prismaClient.verificationArtifact.findFirst({
      where: {
        npi: input.batch.subjectId,
        source: input.batch.source,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      },
      orderBy: {
        verifiedAt: 'desc',
      },
    });

    const retention = evaluateRetentionWindows(input.batch, getSourcePolicy(input.batch.source));
    const created = await this.prismaClient.verificationArtifact.create({
      data: {
        npi: input.batch.subjectId,
        source: input.batch.source,
        status: input.batch.summary.status,
        rawPayload: toJsonValue({
          batch: input.batch,
          retention,
        }),
        checksum: input.batch.rawResponseHash,
        claimHashes: toJsonValue(
          input.batch.facts.map((entry) => ({
            factId: entry.fact.factId,
            factType: entry.fact.factType,
          })),
        ),
        verifiedAt: new Date(input.batch.retrievalTime),
        expiresAt: toDateOrNull(input.batch.summary.expiresAt),
        monitoring: Boolean(input.batch.summary.monitoringEnabled),
        trustState: trustStateForBatch(input.batch),
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      },
    });

    const auditEvents = input.batch.events.map((event) =>
      this.prismaClient.auditEvent.create({
        data: {
          type: event.eventType,
          hash: hashSensitiveInput({
            eventId: event.eventId,
            batchId: input.batch.batchId,
          }),
          clinicianId: input.batch.subjectId,
          referenceId: created.id,
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
          metadata: toJsonValue({
            event,
          }),
        },
      }),
    );

    if (
      previous &&
      previous.status !== input.batch.summary.status &&
      (input.batch.summary.status === 'ACTIVE' || input.batch.summary.status === 'EXPIRED')
    ) {
      auditEvents.push(
        this.prismaClient.monitoringEvent.create({
          data: {
            npi: input.batch.subjectId,
            source: input.batch.source,
            previousStatus: previous.status,
            newStatus: input.batch.summary.status,
            ...(input.organizationId ? { organizationId: input.organizationId } : {}),
          },
        }),
      );
    }

    const nursysRows = extractNursysRows(input.batch);
    for (const row of nursysRows) {
      auditEvents.push(
        this.prismaClient.nursysEvent.create({
          data: {
            npi: row.npi,
            licenseNumber: row.licenseNumber,
            state: row.state,
            eventType: row.eventType,
            rawPayload: toJsonValue(row.rawPayload),
            receivedAt: new Date(input.batch.retrievalTime),
          },
        }),
      );
    }

    await Promise.all(auditEvents);

    log('info', 'psv_interop_batch_persisted', {
      artifactId: created.id,
      source: input.batch.source,
      subjectHash: hashSensitiveInput(input.batch.subjectId),
      factCount: input.batch.facts.length,
      eventCount: input.batch.events.length,
    });

    return Object.freeze({
      artifactId: created.id,
      idempotent: false,
      status: input.batch.summary.status,
      factCount: input.batch.facts.length,
      eventCount: input.batch.events.length,
    });
  }

  async recordQueryAudit(input: AdapterQueryAuditRecord): Promise<void> {
    await this.prismaClient.auditEvent.create({
      data: {
        type: 'PSV_ADAPTER_QUERY',
        hash: hashSensitiveInput({
          source: input.source,
          queryHash: input.queryHash,
          occurredAt: input.occurredAt,
        }),
        clinicianId: input.subjectId,
        referenceId: input.source,
        metadata: toJsonValue({
          source: input.source,
          queryHash: input.queryHash,
          queryKind: input.queryKind,
          retrievalMethod: input.retrievalMethod,
          occurredAt: input.occurredAt,
          ...(input.traceparent ? { traceparent: input.traceparent } : {}),
        }),
      },
    });
  }

  async recordDisclosureAudit(input: DisclosureAuditRecord): Promise<void> {
    await this.prismaClient.auditEvent.create({
      data: {
        type: 'PSV_ADAPTER_DISCLOSURE',
        hash: input.disclosureHash,
        clinicianId: input.subjectId,
        referenceId: input.source,
        metadata: toJsonValue({
          audience: input.audience,
          occurredAt: input.occurredAt,
          factIds: input.factIds,
        }),
      },
    });
  }

  async getStatus(subjectId: string, sourceIds?: readonly string[]): Promise<AdapterStatusSnapshot> {
    const rows = await this.prismaClient.verificationArtifact.findMany({
      where: {
        npi: subjectId,
        ...(sourceIds && sourceIds.length > 0 ? { source: { in: [...sourceIds] } } : {}),
      },
      orderBy: {
        verifiedAt: 'desc',
      },
    });

    const latestBySource = new Map<string, VerificationArtifactRecord>();
    for (const row of rows) {
      if (!latestBySource.has(row.source)) {
        latestBySource.set(row.source, row);
      }
    }

    const latest = [...latestBySource.values()];
    const activeCount = latest.filter((row) => row.status === 'ACTIVE').length;
    const readinessScore =
      latest.length > 0 ? Math.round((activeCount / latest.length) * 100) : undefined;

    return Object.freeze({
      ...(latest[0] ? { lastRun: latest[0].verifiedAt.toISOString() } : {}),
      artifactCount: latest.length,
      ...(readinessScore !== undefined ? { readinessScore } : {}),
      activeSources: Object.freeze(
        latest.filter((row) => row.status === 'ACTIVE').map((row) => row.source),
      ),
    });
  }
}
