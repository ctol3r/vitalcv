import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';
import type { PrivilegeEvaluationResult } from './evaluator';
import {
  getPecosSummaryForClinician,
  getCredentialRiskSummary,
} from '../../../../../services/psv/evidenceBundle';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface PrivilegePacketOptions {
  clinicianId: string;
  packId: string;
  evaluation: PrivilegeEvaluationResult;
  includePdf?: boolean;
}

export interface PrivilegePacket {
  packetId: string;
  clinician: {
    id: string;
    name: string | null;
    specialty: string | null;
    orgId: string | null;
  };
  pack: {
    id: string;
    name: string;
    orgId: string;
  };
  evaluation: PrivilegeEvaluationResult & {
    riskCategory: 'green' | 'yellow' | 'red';
  };
  evidence: {
    pecos?: Awaited<ReturnType<typeof getPecosSummaryForClinician>>;
    risk?: Awaited<ReturnType<typeof getCredentialRiskSummary>>;
    licenses: Array<{
      state: string;
      licenseNumber: string | null;
      status: string | null;
      expiresAt: string | null;
    }>;
  };
  audit: {
    anchor: Awaited<ReturnType<ChainClient['submitAuditEvent']>>;
    payloadHash: string;
  };
  generatedAt: string;
  pdfBundle?: string;
}

export async function generatePrivilegePacket(options: PrivilegePacketOptions): Promise<PrivilegePacket> {
  const { clinicianId, packId, evaluation, includePdf } = options;

  const [clinician, pack] = await Promise.all([
    prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { user: true },
    }),
    prisma.privilegePack.findUnique({ where: { id: packId } }),
  ]);

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }
  if (!pack) {
    throw new Error(`Privilege pack ${packId} not found`);
  }

  const [pecos, risk, licenses] = await Promise.all([
    getPecosSummaryForClinician(clinicianId),
    getCredentialRiskSummary(clinicianId),
    prisma.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  const riskCategory = determineRiskCategory(evaluation, risk?.score ?? 0);
  const packetId = createHash('sha256')
    .update(`${clinicianId}:${packId}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16);

  const payloadHash = createHash('sha256')
    .update(
      JSON.stringify({
        packetId,
        clinicianId,
        packId,
        evaluation,
        pecos,
        risk,
      }),
    )
    .digest('hex');

  const anchor = await chainClient.submitAuditEvent({
    eventType: 'privilege.packet.generated',
    payload: {
      packetId,
      clinicianId,
      packId,
      riskCategory,
      issuedAt: new Date().toISOString(),
    },
    tags: ['privilege', 'packet'],
  });

  const packet: PrivilegePacket = {
    packetId,
    clinician: {
      id: clinician.id,
      name: clinician.user?.name ?? null,
      specialty: clinician.specialty,
      orgId: clinician.orgId,
    },
    pack: {
      id: pack.id,
      name: pack.name,
      orgId: pack.orgId,
    },
    evaluation: {
      ...evaluation,
      riskCategory,
    },
    evidence: {
      pecos,
      risk,
      licenses: licenses.map((license) => ({
        state: license.state,
        licenseNumber: license.licenseNumber,
        status: license.status,
        expiresAt: license.expiryDate?.toISOString() ?? null,
      })),
    },
    audit: {
      anchor,
      payloadHash,
    },
    generatedAt: new Date().toISOString(),
  };

  if (includePdf) {
    packet.pdfBundle = Buffer.from(JSON.stringify(packet, null, 2)).toString('base64');
  }

  return packet;
}

function determineRiskCategory(
  evaluation: PrivilegeEvaluationResult,
  riskScore: number,
): 'green' | 'yellow' | 'red' {
  if (!evaluation.eligible) {
    return 'red';
  }
  if (riskScore >= 0.65) {
    return 'red';
  }
  if (
    riskScore >= 0.35 ||
    evaluation.missingRequirements.length > 0 ||
    evaluation.satisfied.length < 2
  ) {
    return 'yellow';
  }
  return 'green';
}










