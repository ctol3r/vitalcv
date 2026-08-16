import type { VerificationRequestStatus } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import {
  readApplicationPacket,
  type ApplicationPacketReadResponse,
  type ReadApplicationPacketInput,
} from '../opportunities/applicationPacketReadService';

export type StartMissionState =
  | 'under_review'
  | 'head_start_accepted'
  | 'requirements_in_progress'
  | 'waiting_on_clinician'
  | 'waiting_on_issuer'
  | 'manual_review'
  | 'start_ready'
  | 'started'
  | 'withdrawn'
  | 'cancelled'
  | 'closed'
  | 'unknown';

export interface MissionBlocker {
  requirementId: string;
  label: string;
  status: string;
  owner: string;
  dueAt: string | null;
}

export interface MissionNextAction {
  kind:
    | 'clinician_requirement'
    | 'authorize_request'
    | 'send_request'
    | 'follow_up'
    | 'employer_review'
    | 'record_start_ready'
    | 'none';
  owner: 'clinician' | 'employer' | 'system' | 'both';
  label: string;
  objectId: string | null;
}

export interface StartMission {
  id: string;
  applicationId: string;
  clinicianNpi: string;
  clinicianUserId: string;
  organizationId: string;
  opportunityId: string;
  opportunityTitle: string;
  acceptedPacketId: string | null;
  acceptedPacketHash: string | null;
  acceptanceId: string | null;
  intendedStartDate: string | null;
  urgency: 'routine' | 'priority' | 'critical';
  state: StartMissionState;
  rawState: string;
  packetBinding: 'bound' | 'legacy_unbound';
  requirements: Array<{
    id: string;
    category: string;
    label: string;
    necessity: string;
    status: string;
    owner: string;
    evidenceRule: string | null;
    dependencyIds: string[];
    dueAt: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
    policyVersion: string | null;
  }>;
  verificationRequests: Array<{
    requestId: string;
    status: string;
    source: string;
    requestedClaim: string | null;
    issuerId: string | null;
    preferredChannel: string | null;
    dueAt: string | null;
    nextFollowUpAt: string | null;
    attemptCount: number;
    failureReason: string | null;
  }>;
  recentCommunications: Array<{
    id: string;
    direction: string;
    channel: string;
    eventType: string;
    status: string;
    redactedSummary: string | null;
    occurredAt: string;
  }>;
  blockerSummary: MissionBlocker[];
  nextAction: MissionNextAction;
  limitations: string[];
  createdAt: string;
  updatedAt: string;
}

export type StartMissionReadResult =
  | {
      status: 'not_opened';
      applicationId: string;
      opportunityId: string;
      accessPerspective: ApplicationPacketReadResponse['accessPerspective'];
      packetHash: string | null;
      notice: string;
    }
  | {
      status: 'open';
      accessPerspective: ApplicationPacketReadResponse['accessPerspective'];
      mission: StartMission;
    };

interface MissionPersistenceRecord {
  application: {
    id: string;
    clerkUserId: string;
    npi: string | null;
    opportunityId: string;
    opportunity: { organizationId: string; title: string };
  };
  activation: null | {
    id: string;
    clinicianNpi: string;
    orgId: string;
    acceptanceId: string | null;
    activationState: string;
    applicationId: string | null;
    opportunityId: string | null;
    acceptedPacketId: string | null;
    acceptedPacketHash: string | null;
    intendedStartDate: Date | null;
    urgency: string;
    policyVersion: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  acceptedPacket: null | { id: string; applicationId: string; packetVersion: number; packetHash: string };
  acceptance: null | { id: string; applicationId: string | null; packetHash: string | null };
  requirements: Array<{
    id: string;
    category: string;
    label: string;
    necessity: string;
    status: string;
    owner: string;
    evidenceRule: string | null;
    dependencyIds: string[];
    dueAt: Date | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    policyVersion: string | null;
  }>;
  verificationRequests: Array<{
    requestId: string;
    status: VerificationRequestStatus;
    source: string;
    requestedClaim: string | null;
    issuerId: string | null;
    preferredChannel: string | null;
    dueAt: Date | null;
    nextFollowUpAt: Date | null;
    attemptCount: number;
    failureReason: string | null;
  }>;
  communications: Array<{
    id: string;
    direction: string;
    channel: string;
    eventType: string;
    status: string;
    redactedSummary: string | null;
    occurredAt: Date;
  }>;
}

export interface StartMissionReadDependencies {
  readPacket(input: ReadApplicationPacketInput): Promise<ApplicationPacketReadResponse>;
  load(applicationId: string): Promise<MissionPersistenceRecord | null>;
}

const TERMINAL_REQUIREMENT = new Set(['met', 'waived', 'not_applicable']);
const KNOWN_URGENCY = new Set(['routine', 'priority', 'critical']);

function notFound(): HttpError {
  return new HttpError(404, 'Start Mission not found.');
}

function bindingFailure(message: string): HttpError {
  return new HttpError(409, message, 'START_MISSION_BINDING_FAILED');
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function normalizeStartMissionState(raw: string): StartMissionState {
  const normalized = raw.trim().toLowerCase();
  switch (normalized) {
    case 'under_review':
    case 'head_start_accepted':
    case 'requirements_in_progress':
    case 'waiting_on_clinician':
    case 'waiting_on_issuer':
    case 'manual_review':
    case 'start_ready':
    case 'started':
    case 'withdrawn':
    case 'cancelled':
    case 'closed':
      return normalized;
    default:
      return 'unknown';
  }
}

function blockersOf(record: MissionPersistenceRecord): MissionBlocker[] {
  return record.requirements
    .filter((requirement) => (
      requirement.necessity === 'required'
      && !TERMINAL_REQUIREMENT.has(requirement.status)
    ))
    .map((requirement) => ({
      requirementId: requirement.id,
      label: requirement.label,
      status: requirement.status,
      owner: requirement.owner,
      dueAt: iso(requirement.dueAt),
    }));
}

function nextActionOf(record: MissionPersistenceRecord, blockers: MissionBlocker[]): MissionNextAction {
  const authorization = record.verificationRequests.find((request) => request.status === 'AWAITING_AUTHORIZATION');
  if (authorization) {
    return { kind: 'authorize_request', owner: 'clinician', label: 'Authorize the source request.', objectId: authorization.requestId };
  }
  const ready = record.verificationRequests.find((request) => request.status === 'READY_TO_SEND');
  if (ready) {
    return { kind: 'send_request', owner: 'employer', label: 'Review and send the prepared source request.', objectId: ready.requestId };
  }
  const followUp = record.verificationRequests.find((request) => (
    request.status === 'AWAITING_RESPONSE'
    && request.nextFollowUpAt !== null
  ));
  if (followUp) {
    return { kind: 'follow_up', owner: 'system', label: 'Follow up with the source.', objectId: followUp.requestId };
  }
  const clinicianBlocker = blockers.find((blocker) => blocker.owner === 'clinician' || blocker.owner === 'both');
  if (clinicianBlocker) {
    return { kind: 'clinician_requirement', owner: 'clinician', label: clinicianBlocker.label, objectId: clinicianBlocker.requirementId };
  }
  if (blockers.length > 0) {
    return { kind: 'employer_review', owner: 'employer', label: blockers[0].label, objectId: blockers[0].requirementId };
  }
  if (normalizeStartMissionState(record.activation?.activationState ?? '') !== 'start_ready'
    && normalizeStartMissionState(record.activation?.activationState ?? '') !== 'started') {
    return { kind: 'record_start_ready', owner: 'employer', label: 'Record start-ready after institutional review.', objectId: record.activation?.id ?? null };
  }
  return { kind: 'none', owner: 'system', label: 'No next action is currently recorded.', objectId: null };
}

async function loadFromPrisma(applicationId: string): Promise<MissionPersistenceRecord | null> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      clerkUserId: true,
      npi: true,
      opportunityId: true,
      opportunity: { select: { organizationId: true, title: true } },
    },
  });
  if (!application) return null;

  const activation = await prisma.startActivation.findUnique({
    where: { applicationId },
    select: {
      id: true,
      clinicianNpi: true,
      orgId: true,
      acceptanceId: true,
      activationState: true,
      applicationId: true,
      opportunityId: true,
      acceptedPacketId: true,
      acceptedPacketHash: true,
      intendedStartDate: true,
      urgency: true,
      policyVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const [requirements, verificationRequests, communications, acceptance, acceptedPacket] = await Promise.all([
    prisma.activationRequirement.findMany({
      where: { applicationId },
      orderBy: [{ necessity: 'asc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        category: true,
        label: true,
        necessity: true,
        status: true,
        owner: true,
        evidenceRule: true,
        dependencyIds: true,
        dueAt: true,
        resolvedBy: true,
        resolvedAt: true,
        policyVersion: true,
      },
    }),
    prisma.verificationRequest.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: {
        requestId: true,
        status: true,
        source: true,
        requestedClaim: true,
        issuerId: true,
        preferredChannel: true,
        dueAt: true,
        nextFollowUpAt: true,
        attemptCount: true,
        failureReason: true,
      },
    }),
    prisma.communicationEvent.findMany({
      where: { applicationId },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: {
        id: true,
        direction: true,
        channel: true,
        eventType: true,
        status: true,
        redactedSummary: true,
        occurredAt: true,
      },
    }),
    prisma.employerAcceptance.findFirst({
      where: { applicationId },
      orderBy: { acceptedAt: 'desc' },
      select: { id: true, applicationId: true, packetHash: true },
    }),
    activation?.acceptedPacketId
      ? prisma.applicationPacket.findUnique({
          where: { id: activation.acceptedPacketId },
          select: { id: true, applicationId: true, packetVersion: true, packetHash: true },
        })
      : Promise.resolve(null),
  ]);

  return { application, activation, acceptedPacket, acceptance, requirements, verificationRequests, communications };
}

const DEFAULT_DEPENDENCIES: StartMissionReadDependencies = {
  readPacket: readApplicationPacket,
  load: loadFromPrisma,
};

/**
 * Authorized historical mission view. The packet reader performs the existing
 * clinician/employer/admin authorization and verifies immutable packet bytes
 * before any mission data is returned. This service never rereads current trust
 * state or infers a mission from Application.status.
 */
export async function readStartMission(
  input: ReadApplicationPacketInput,
  dependencies: StartMissionReadDependencies = DEFAULT_DEPENDENCIES,
  authorizedPacket?: ApplicationPacketReadResponse,
): Promise<StartMissionReadResult> {
  const submittedPacket = authorizedPacket ?? await dependencies.readPacket(input);
  const record = await dependencies.load(input.applicationId);
  if (!record) throw notFound();

  if (!record.activation) {
    return {
      status: 'not_opened',
      applicationId: record.application.id,
      opportunityId: record.application.opportunityId,
      accessPerspective: submittedPacket.accessPerspective,
      packetHash: submittedPacket.submittedPacket?.packetHash ?? null,
      notice: 'No Start Mission has been explicitly opened for this application.',
    };
  }

  if (record.activation.applicationId !== record.application.id) {
    throw bindingFailure('Start Mission application binding is invalid.');
  }
  if (record.activation.opportunityId && record.activation.opportunityId !== record.application.opportunityId) {
    throw bindingFailure('Start Mission opportunity binding is invalid.');
  }
  if (record.activation.orgId !== record.application.opportunity.organizationId) {
    throw bindingFailure('Start Mission organization binding is invalid.');
  }
  if (record.activation.clinicianNpi !== record.application.npi) {
    throw bindingFailure('Start Mission clinician binding is invalid.');
  }

  let exactPacket = submittedPacket;
  let packetBinding: StartMission['packetBinding'] = 'legacy_unbound';
  const limitations: string[] = [];

  if (record.activation.acceptedPacketId || record.activation.acceptedPacketHash) {
    if (!record.acceptedPacket || record.acceptedPacket.applicationId !== record.application.id) {
      throw bindingFailure('Accepted packet record is missing or belongs to another application.');
    }
    exactPacket = authorizedPacket
      && submittedPacket.submittedPacket?.packetVersion === record.acceptedPacket.packetVersion
      ? submittedPacket
      : await dependencies.readPacket({
          ...input,
          packetVersion: record.acceptedPacket.packetVersion,
        });
    const replayedHash = exactPacket.submittedPacket?.packetHash ?? null;
    if (
      !replayedHash
      || replayedHash !== record.acceptedPacket.packetHash
      || replayedHash !== record.activation.acceptedPacketHash
    ) {
      throw bindingFailure('Accepted packet hash does not match the replayed packet.');
    }
    packetBinding = 'bound';
  } else {
    limitations.push('Legacy activation has no accepted packet binding; no head-start acceptance is inferred.');
  }

  if (record.acceptance?.packetHash && record.activation.acceptedPacketHash
    && record.acceptance.packetHash !== record.activation.acceptedPacketHash) {
    throw bindingFailure('Employer acceptance and Start Mission packet hashes disagree.');
  }

  const blockers = blockersOf(record);
  const rawState = record.activation.activationState;
  const state = normalizeStartMissionState(rawState);
  if (state === 'unknown') limitations.push(`Unrecognized persisted activation state: ${rawState}.`);
  if (!KNOWN_URGENCY.has(record.activation.urgency)) {
    limitations.push(`Unrecognized mission urgency: ${record.activation.urgency}.`);
  }

  const mission: StartMission = {
    id: record.activation.id,
    applicationId: record.application.id,
    clinicianNpi: record.activation.clinicianNpi,
    clinicianUserId: record.application.clerkUserId,
    organizationId: record.application.opportunity.organizationId,
    opportunityId: record.application.opportunityId,
    opportunityTitle: record.application.opportunity.title,
    acceptedPacketId: record.activation.acceptedPacketId,
    acceptedPacketHash: record.activation.acceptedPacketHash,
    acceptanceId: record.activation.acceptanceId ?? record.acceptance?.id ?? null,
    intendedStartDate: iso(record.activation.intendedStartDate),
    urgency: KNOWN_URGENCY.has(record.activation.urgency)
      ? record.activation.urgency as StartMission['urgency']
      : 'routine',
    state,
    rawState,
    packetBinding,
    requirements: record.requirements.map((requirement) => ({
      ...requirement,
      dueAt: iso(requirement.dueAt),
      resolvedAt: iso(requirement.resolvedAt),
    })),
    verificationRequests: record.verificationRequests.map((request) => ({
      ...request,
      status: request.status,
      dueAt: iso(request.dueAt),
      nextFollowUpAt: iso(request.nextFollowUpAt),
    })),
    recentCommunications: record.communications.map((event) => ({
      ...event,
      occurredAt: event.occurredAt.toISOString(),
    })),
    blockerSummary: blockers,
    nextAction: nextActionOf(record, blockers),
    limitations,
    createdAt: record.activation.createdAt.toISOString(),
    updatedAt: record.activation.updatedAt.toISOString(),
  };

  return { status: 'open', accessPerspective: exactPacket.accessPerspective, mission };
}
