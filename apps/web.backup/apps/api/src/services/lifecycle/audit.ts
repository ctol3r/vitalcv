import { PrismaClient, Prisma, CredentialLifecycle } from '@prisma/client';
import { AuditAnchorService } from '../audit/anchor';
import type { LifecyclePhase } from './transition';

const prisma = new PrismaClient();

export class LifecycleAuditLog {
  private readonly anchorService: AuditAnchorService;

  constructor(private readonly db: PrismaClient = prisma, anchorService?: AuditAnchorService) {
    this.anchorService = anchorService ?? new AuditAnchorService();
  }

  async recordTransition(
    record: CredentialLifecycle,
    options: { previousPhase?: LifecyclePhase; clinicianId?: string } = {},
  ): Promise<void> {
    try {
      const clinicianId =
        options.clinicianId ?? (await this.resolveClinicianId(record.credentialId));
      if (!clinicianId) {
        return;
      }
      const metadata = {
        transitionId: record.id,
        phase: record.phase,
        previousPhase: options.previousPhase ?? null,
        triggeredBy: extractMetadataField(record.metadata, 'triggeredBy'),
        reason: extractMetadataField(record.metadata, 'reason'),
        transitionType: extractMetadataField(record.metadata, 'transitionType'),
      } satisfies Record<string, unknown>;

      await this.db.custodyRecord.create({
        data: {
          clinicianId,
          documentId: record.credentialId,
          action: 'lifecycle_transition',
          metadata: metadata as Prisma.InputJsonValue,
          timestamp: record.timestamp,
        },
      });

      await this.anchorService.anchor({
        eventType: 'lifecycleEventAnchored',
        correlationId: `${clinicianId}:${record.credentialId}`,
        tags: ['lifecycle', record.phase],
        payload: {
          clinicianId,
          credentialId: record.credentialId,
          phase: record.phase,
          previousPhase: options.previousPhase ?? null,
          timestamp: record.timestamp.toISOString(),
          metadata: record.metadata ?? {},
        },
      });
    } catch (error) {
      console.error('[lifecycle-audit] failed to persist transition audit', error);
    }
  }

  async listTransitions(credentialId: string, limit = 50): Promise<CredentialLifecycle[]> {
    return this.db.credentialLifecycle.findMany({
      where: { credentialId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  private async resolveClinicianId(credentialId: string): Promise<string | null> {
    const credential = await this.db.walletCredential.findUnique({
      where: { credentialId },
      select: { clinicianId: true },
    });
    return credential?.clinicianId ?? null;
  }
}

function extractMetadataField(metadata: Prisma.JsonValue | null, field: string): unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  return record[field] ?? null;
}


