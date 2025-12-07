import {
  CredentialTimelineEventType,
  NCINodeType,
  NCIVerifiableProofType,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { createJobLogger } from '@packages/queue-core';
import type { JobQueueRecord } from '../../queue/models/JobQueue.js';
import {
  parseJobPayload,
  type JobPayloadMap,
} from '../../queue/validation/payloadValidator.js';
import { VerifiableProofRegistry } from '../verifiableProofRegistry.js';
import { NCINodeService } from '../models/NCINode.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { KeyedConcurrencyGate } from '../../queue/handlers/concurrency.js';

const handlerLogger = getServiceLogger('nci/publishProofsHandler');
const publishProofsConcurrency = new KeyedConcurrencyGate('NCI_PUBLISH_PROOFS');

interface ClinicianContext {
  id: string;
  did: string;
  name: string | null;
  npi: string;
  state: string;
}

interface ProofBundle {
  generatedAt: string;
  clinician: ClinicianContext;
  summary: {
    licenseCount: number;
    privilegeCount: number;
    openSafetySignals: number;
    timelineSampleSize: number;
  };
  licenses: Array<{
    state: string;
    licenseNumber: string;
    status: string;
    expiresAt: string | null;
  }>;
  privileges: Array<{
    id: string;
    orgId: string;
    privilegeSetId: string;
    status: string;
    expiresAt: string | null;
  }>;
  timeline: Array<{
    id: string;
    eventType: string;
    severity: string;
    timestamp: string;
  }>;
  safetySignals: Array<{
    id: string;
    signalType: string;
    severity: string;
    detectedAt: string;
    summary: string;
  }>;
}

export interface PublishProofsHandlerDeps {
  prisma?: PrismaClient;
  proofRegistry?: VerifiableProofRegistry;
  nodeService?: NCINodeService;
  timelineLogger?: typeof logCredentialTimelineEvent;
}

type PublishProofsPayload = JobPayloadMap['NCI_PUBLISH_PROOFS'];

export function createPublishProofsHandler(
  deps: PublishProofsHandlerDeps = {},
) {
  const prisma = deps.prisma ?? new PrismaClient();
  const registry = deps.proofRegistry ?? new VerifiableProofRegistry(prisma);
  const nodeService = deps.nodeService ?? new NCINodeService(prisma);
  const timelineLogger = deps.timelineLogger ?? logCredentialTimelineEvent;

  return async function handleNciPublishProofsJob(
    job: JobQueueRecord,
  ): Promise<void> {
    const payload = parseJobPayload(job, 'NCI_PUBLISH_PROOFS');
    const jobLogger = createJobLogger(job, { baseLogger: handlerLogger });

    await publishProofsConcurrency.run(payload.clinicianId, async () => {
      const clinician = await loadClinicianContext(prisma, payload);

      await nodeService.registerNode({
        did: clinician.did,
        nodeType: NCINodeType.CLINICIAN,
        metadata: {
          clinicianId: clinician.id,
          npi: clinician.npi,
          state: clinician.state,
          name: clinician.name ?? undefined,
        },
      });

      const bundle = await buildProofBundle(prisma, clinician);
      const proofTypes = dedupeProofTypes(payload.proofTypes);

      for (const proofType of proofTypes) {
        const proofRecord = await registry.recordProof({
          did: clinician.did,
          proofType,
          eventType: resolveProofEventType(proofType),
          payload: {
            ...bundle,
            proofType,
          },
          metadata: {
            clinicianId: clinician.id,
            bundleGeneratedAt: bundle.generatedAt,
            licenseCount: bundle.summary.licenseCount,
            privilegeCount: bundle.summary.privilegeCount,
          },
          issuedFor: clinician.id,
        });

        await timelineLogger({
          clinicianId: clinician.id,
          eventType: CredentialTimelineEventType.VC_ISSUED,
          severity: TimelineEventSeverity.INFO,
          metadata: {
            proofId: proofRecord.id,
            proofType,
            nodeDid: clinician.did,
          },
        });

        jobLogger.info('NCI proof recorded', {
          proofType,
          proofId: proofRecord.id,
          clinicianId: clinician.id,
        });
      }
    });
  };
}

export const handleNciPublishProofsJob = createPublishProofsHandler();

async function loadClinicianContext(
  prisma: PrismaClient,
  payload: PublishProofsPayload,
): Promise<ClinicianContext> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: payload.clinicianId },
    include: {
      user: {
        select: {
          did: true,
          name: true,
        },
      },
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${payload.clinicianId} not found`);
  }

  if (!clinician.user?.did) {
    throw new Error(
      `Clinician ${payload.clinicianId} is missing a registered DID`,
    );
  }

  return {
    id: clinician.id,
    did: clinician.user.did,
    name: clinician.user.name,
    npi: clinician.npi,
    state: clinician.state,
  };
}

async function buildProofBundle(
  prisma: PrismaClient,
  clinician: ClinicianContext,
): Promise<ProofBundle> {
  const generatedAt = new Date().toISOString();

  const [licenses, privileges, timelineEvents, safetySignals] =
    await Promise.all([
      prisma.stateLicenseVerification.findMany({
        where: { clinicianId: clinician.id },
      }),
      prisma.privilegeGranted.findMany({
        where: { clinicianDid: clinician.did },
      }),
      prisma.credentialTimelineEvent.findMany({
        where: { clinicianId: clinician.id },
        orderBy: { timestamp: 'desc' },
        take: 25,
      }),
      prisma.privilegeSafetySignal.findMany({
        where: { clinicianId: clinician.id },
        orderBy: { detectedAt: 'desc' },
        take: 10,
      }),
    ]);

  const licenseSnapshot = [...licenses]
    .sort((a, b) =>
      a.state === b.state
        ? a.licenseNumber.localeCompare(b.licenseNumber)
        : a.state.localeCompare(b.state),
    )
    .map((license) => ({
      state: license.state,
      licenseNumber: license.licenseNumber,
      status: license.status,
      expiresAt: license.expiryDate?.toISOString() ?? null,
    }));

  const privilegeSnapshot = [...privileges]
    .sort((a, b) =>
      a.orgId === b.orgId
        ? a.privilegeSetId.localeCompare(b.privilegeSetId)
        : a.orgId.localeCompare(b.orgId),
    )
    .map((priv) => ({
      id: priv.id,
      orgId: priv.orgId,
      privilegeSetId: priv.privilegeSetId,
      status: priv.status,
      expiresAt: priv.expiresAt?.toISOString() ?? null,
    }));

  const timelineSnapshot = timelineEvents.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    severity: event.severity,
    timestamp: event.timestamp.toISOString(),
  }));

  const safetySnapshot = safetySignals.map((signal) => ({
    id: signal.id,
    signalType: signal.signalType,
    severity: signal.severity,
    detectedAt: signal.detectedAt.toISOString(),
    summary: signal.summary,
  }));

  return {
    generatedAt,
    clinician,
    summary: {
      licenseCount: licenseSnapshot.length,
      privilegeCount: privilegeSnapshot.length,
      openSafetySignals: safetySnapshot.filter((signal) =>
        ['HIGH', 'CRITICAL'].includes(signal.severity),
      ).length,
      timelineSampleSize: timelineSnapshot.length,
    },
    licenses: licenseSnapshot,
    privileges: privilegeSnapshot,
    timeline: timelineSnapshot,
    safetySignals: safetySnapshot,
  };
}

function resolveProofEventType(type: NCIVerifiableProofType): string {
  switch (type) {
    case NCIVerifiableProofType.ISSUANCE:
      return 'nci.proof.issuance';
    case NCIVerifiableProofType.VERIFICATION:
      return 'nci.proof.verification';
    case NCIVerifiableProofType.REVOCATION:
      return 'nci.proof.revocation';
    default:
      return 'nci.proof.unknown';
  }
}

function dedupeProofTypes(
  proofTypes: PublishProofsPayload['proofTypes'],
): NCIVerifiableProofType[] {
  return Array.from(new Set(proofTypes));
}

