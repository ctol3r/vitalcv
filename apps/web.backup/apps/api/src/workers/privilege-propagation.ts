import { PrismaClient } from '@prisma/client';
import { PrivilegeEvaluator } from '../services/privileges/evaluator';
import { buildCredentialGraph } from '../services/privileges/graph';
import { generatePrivilegePacket } from '../services/privileges/packet';
import { ChainClient } from '../services/chain/client';

const prisma = new PrismaClient();
const evaluator = new PrivilegeEvaluator();
const chain = new ChainClient();

export interface PrivilegePropagationJob {
  clinicianId: string;
  approvedOrgId: string;
  initiatedBy?: string;
  maxTargets?: number;
}

export interface PrivilegePropagationResult {
  propagated: Array<{
    packId: string;
    orgId: string;
    packetId: string;
    anchorTx: string;
  }>;
  rejected: Array<{
    packId: string;
    orgId: string;
    reason: string;
  }>;
}

export async function runPrivilegePropagation(
  job: PrivilegePropagationJob,
): Promise<PrivilegePropagationResult> {
  const graph = await buildCredentialGraph(job.clinicianId);
  if (!graph) {
    throw new Error(`Clinician ${job.clinicianId} not found for propagation`);
  }

  const packs = await prisma.privilegePack.findMany({
    where: {
      orgId: {
        not: job.approvedOrgId,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: job.maxTargets ?? 10,
  });

  const propagated: PrivilegePropagationResult['propagated'] = [];
  const rejected: PrivilegePropagationResult['rejected'] = [];

  for (const pack of packs) {
    const evaluation = evaluator.evaluate(graph, pack.rules as any);
    if (!evaluation.eligible) {
      rejected.push({
        packId: pack.id,
        orgId: pack.orgId,
        reason:
          evaluation.missingRequirements.length > 0
            ? `Missing: ${evaluation.missingRequirements.join(', ')}`
            : 'Evaluator returned ineligible',
      });
      continue;
    }

    const packet = await generatePrivilegePacket({
      clinicianId: job.clinicianId,
      packId: pack.id,
      evaluation,
      includePdf: false,
    });

    const anchor = await chain.submitAuditEvent({
      eventType: 'privilege.auto_propagated',
      payload: {
        clinicianId: job.clinicianId,
        fromOrg: job.approvedOrgId,
        targetOrg: pack.orgId,
        packetId: packet.packetId,
        initiatedBy: job.initiatedBy ?? 'system',
      },
      tags: ['privilege', 'propagation'],
    });

    propagated.push({
      packId: pack.id,
      orgId: pack.orgId,
      packetId: packet.packetId,
      anchorTx: anchor.txHash,
    });
  }

  return { propagated, rejected };
}










