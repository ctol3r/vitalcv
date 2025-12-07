import { PrismaClient, CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { buildPrivilegeGraph } from '../graph';
import { normalizePrivilegeCode } from '../types';
import { emitPrivilegeGraphChange } from '../events/emitter';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent';
import { resolveClinicianContext } from '../../common/clinicianContext';

const prisma = new PrismaClient();

export type PracticeImpactEvent =
  | {
      type: 'DOWNSTREAM_PRIVILEGE_ADDED';
      clinicianId: string;
      orgId: string;
      privilegeCode: string;
      privilegeGrantedId?: string;
      fppeDays?: number;
      reason?: string;
    }
  | {
    type: 'UPSTREAM_PRIVILEGE_REMOVED';
    clinicianId: string;
    orgId: string;
    privilegeCode: string;
    reason?: string;
  }
  | {
    type: 'OPPE_PERFORMANCE_LOW';
    clinicianId: string;
    orgId: string;
    privilegeCode: string;
    oppeCaseId?: string;
    metrics?: Record<string, unknown>;
    threshold?: number;
    reason?: string;
  };

export interface PracticeImpactResult {
  fppeCaseId?: string;
  restrictedPrivileges?: string[];
  updatedOppeCaseId?: string;
  notifications?: string[];
}

async function findGrantForPrivilege(
  clinicianDid: string | undefined,
  orgId: string,
  privilegeCode: string
) {
  if (!clinicianDid) return null;
  const normalizedCode = normalizePrivilegeCode(privilegeCode);
  return prisma.privilegeGranted.findFirst({
    where: {
      orgId,
      clinicianDid,
      privilegeRequest: {
        privilegeSetV2: {
          privileges: {
            some: { privilegeCode: normalizedCode },
          },
        },
      },
    },
  });
}

async function ensureFppeCase(
  privilegeGrantedId: string,
  clinicianId: string,
  orgId: string,
  privilegeCode: string,
  fppeDays = 90
): Promise<string> {
  const existing = await prisma.fPPECase.findFirst({
    where: {
      privilegeGrantedId,
      privilegeCode,
      status: 'OPEN',
    },
  });

  if (existing) {
    return existing.id;
  }

  const startAt = new Date();
  const dueAt = new Date(startAt.getTime() + fppeDays * 24 * 60 * 60 * 1000);

  const record = await prisma.fPPECase.create({
    data: {
      clinicianId,
      orgId,
      privilegeGrantedId,
      privilegeCode,
      startAt,
      dueAt,
      status: 'OPEN',
    },
  });

  await logCredentialTimelineEvent({
    clinicianId,
    eventType: CredentialTimelineEventType.FPPE_STARTED,
    severity: TimelineEventSeverity.NOTICE,
    metadata: {
      privilegeCode,
      fppeCaseId: record.id,
      dueAt: dueAt.toISOString(),
    },
  });

  return record.id;
}

async function holdPrivileges(
  clinicianId: string,
  codes: string[],
  reason: string
): Promise<string[]> {
  if (!codes.length) return [];

  const normalized = codes.map((code) => normalizePrivilegeCode(code));

  const impacted = await prisma.privilegeGranted.findMany({
    where: {
      privilegeRequest: {
        privilegeSetV2: {
          privileges: {
            some: { privilegeCode: { in: normalized } },
          },
        },
      },
      status: 'ACTIVE',
    },
  });

  if (!impacted.length) {
    return [];
  }

  await prisma.privilegeGranted.updateMany({
    where: {
      id: { in: impacted.map((grant) => grant.id) },
    },
    data: {
      status: 'HOLD',
      revocationReason: reason,
    },
  });

  await logCredentialTimelineEvent({
    clinicianId,
    eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
    severity: TimelineEventSeverity.WARNING,
    metadata: {
      reason,
      restrictedPrivileges: normalized,
    },
  });

  return normalized;
}

function collectDownstreamCodes(graph: Awaited<ReturnType<typeof buildPrivilegeGraph>>, rootCode: string): string[] {
  const queue: string[] = [rootCode];
  const visited = new Set<string>();
  const collected: Set<string> = new Set();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    const dependents = graph.downstream.get(node);
    if (!dependents) continue;
    for (const dependent of dependents) {
      if (!visited.has(dependent)) {
        collected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  collected.delete(rootCode);
  return Array.from(collected);
}

export async function applyPrivilegePracticeImpact(
  event: PracticeImpactEvent
): Promise<PracticeImpactResult> {
  const normalizedCode = normalizePrivilegeCode(event.privilegeCode);
  const context = await resolveClinicianContext({ clinicianId: event.clinicianId });
  if (!context) {
    throw new Error(`Clinician ${event.clinicianId} not found`);
  }

  switch (event.type) {
    case 'DOWNSTREAM_PRIVILEGE_ADDED': {
      const grant =
        event.privilegeGrantedId ??
        (await findGrantForPrivilege(context.clinicianDid, event.orgId, normalizedCode))?.id;

      if (!grant) {
        return { notifications: [`No privilege grant found for ${normalizedCode}`] };
      }

      const fppeCaseId = await ensureFppeCase(
        grant,
        context.clinicianId,
        event.orgId,
        normalizedCode,
        event.fppeDays
      );

      await emitPrivilegeGraphChange({
        clinicianId: context.clinicianId,
        clinicianDid: context.clinicianDid,
        orgId: event.orgId,
        changeType: 'PRIVILEGE_ADDED',
        privilegeCode: normalizedCode,
        reason: event.reason ?? 'Downstream privilege granted, FPPE initiated',
        metadata: { fppeCaseId },
      });

      return { fppeCaseId };
    }
    case 'UPSTREAM_PRIVILEGE_REMOVED': {
      const graph = await buildPrivilegeGraph(normalizedCode, { maxDepth: 3 });
      const downstream = collectDownstreamCodes(graph, normalizedCode);
      const restricted = await holdPrivileges(
        context.clinicianId,
        downstream,
        event.reason ?? `Upstream privilege ${normalizedCode} removed`
      );

      if (restricted.length) {
        await emitPrivilegeGraphChange({
          clinicianId: context.clinicianId,
          clinicianDid: context.clinicianDid,
          orgId: event.orgId,
          changeType: 'PRIVILEGE_REMOVED',
          privilegeCode: normalizedCode,
          reason: event.reason ?? 'Upstream privilege removed',
          impactedPrivileges: restricted.map((code) => ({
            privilegeCode: code,
            impact: 'BLOCKED',
            reason: 'Cascade restriction',
            depth: 1,
          })),
        });
      }

      return { restrictedPrivileges: restricted };
    }
    case 'OPPE_PERFORMANCE_LOW': {
      let oppeCaseId = event.oppeCaseId;
      if (!oppeCaseId) {
        const oppeCase = await prisma.oPPECase.findFirst({
          where: {
            clinicianId: context.clinicianId,
            privilegeCode: normalizedCode,
            status: { in: ['OPEN', 'REVIEWING'] },
          },
        });
        oppeCaseId = oppeCase?.id;
      }

      if (oppeCaseId) {
        await prisma.oPPECase.update({
          where: { id: oppeCaseId },
          data: {
            status: 'FAILED',
            metrics: event.metrics ?? undefined,
          },
        });
      }

      const graph = await buildPrivilegeGraph(normalizedCode, { maxDepth: 3 });
      const downstream = collectDownstreamCodes(graph, normalizedCode);
      const restricted = await holdPrivileges(
        context.clinicianId,
        downstream,
        event.reason ?? 'OPPE performance below threshold'
      );

      if (restricted.length) {
        await emitPrivilegeGraphChange({
          clinicianId: context.clinicianId,
          clinicianDid: context.clinicianDid,
          orgId: event.orgId,
          changeType: 'PRIVILEGE_REMOVED',
          privilegeCode: normalizedCode,
          reason: event.reason ?? 'OPPE performance low',
          impactedPrivileges: restricted.map((code) => ({
            privilegeCode: code,
            impact: 'BLOCKED',
            reason: 'Failed OPPE metrics',
            depth: 1,
          })),
        });
      }

      return { restrictedPrivileges: restricted, updatedOppeCaseId: oppeCaseId };
    }
    default:
      return { notifications: ['Unsupported practice impact event'] };
  }
}

