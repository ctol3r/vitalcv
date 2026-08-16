/**
 * Authorized joined hire-to-start case.
 *
 * Packet authorization and integrity verification remain delegated to the
 * canonical packet reader. StartMission remains the requirement/next-action
 * source of truth. This service joins those records with application,
 * decision, start, and milestone facts without exposing employer review notes.
 */
import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import {
  readApplicationPacket,
  type ApplicationPacketReadResponse,
  type ReadApplicationPacketInput,
} from './applicationPacketReadService';
import {
  readStartMission,
  type StartMission,
  type StartMissionReadResult,
} from '../activation/startMissionReadService';

export type HireToStartStage =
  | 'application_submitted'
  | 'employer_review'
  | 'clarification'
  | 'head_start_accepted'
  | 'requirements_in_progress'
  | 'start_ready'
  | 'started'
  | 'not_proceeding'
  | 'cancelled';

export type HireToStartMilestoneType =
  | 'application_submitted'
  | 'employer_first_review'
  | 'decision_recorded'
  | 'head_start_accepted'
  | 'start_ready_recorded'
  | 'actual_start_confirmed';

export interface JoinedPersistenceRecord {
  application: {
    id: string;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    opportunity: {
      id: string;
      title: string;
      specialty: string;
      hiringType: string;
      state: string;
      organizationId: string;
      updatedAt: Date;
    };
  };
  acceptance: null | {
    id: string;
    status: string | null;
    packetHash: string | null;
    acceptedAt: Date;
  };
  attestation: null | {
    id: string;
    acceptanceId: string;
    startedAt: Date;
    createdAt: Date;
  };
  auditEvents: Array<{ type: string; createdAt: Date }>;
}

export interface HireToStartReadDependencies {
  readPacket(input: ReadApplicationPacketInput): Promise<ApplicationPacketReadResponse>;
  readMission(
    input: ReadApplicationPacketInput,
    authorizedPacket?: ApplicationPacketReadResponse,
  ): Promise<StartMissionReadResult>;
  load(applicationId: string): Promise<JoinedPersistenceRecord | null>;
}

export interface HireToStartReadModel {
  application: {
    id: string;
    status: string;
    submittedAt: string;
    opportunity: {
      id: string;
      submittedVersion: string | null;
      currentVersion: string;
      title: string;
      specialty: string;
      hiringType: string;
      state: string;
      organizationId: string;
    };
  };
  accessPerspective: ApplicationPacketReadResponse['accessPerspective'];
  submission: ApplicationPacketReadResponse;
  packetBinding: {
    state: 'bound' | 'legacy_unbound' | 'not_opened';
    packetVersion: number | null;
    packetHash: string | null;
    integrity: 'valid' | 'legacy_unavailable';
    limitations: string[];
  };
  decision: null | {
    state: 'under_review' | 'accepted_as_head_start' | 'not_proceeding';
    decidedAt: string | null;
    acceptanceId: string | null;
    packetHash: string | null;
    institutionReviewRemains: true;
  };
  currentStage: HireToStartStage;
  intendedStartDate: string | null;
  actualStart: null | {
    attestationId: string;
    actualFirstDay: string;
    recordedAt: string;
    employerConfirmed: true;
  };
  requirements: StartMission['requirements'];
  blockerSummary: StartMission['blockerSummary'];
  primaryNextAction: StartMission['nextAction'];
  milestones: Array<{ type: HireToStartMilestoneType; occurredAt: string }>;
  externalSystemSync: {
    state: 'not_configured';
    lastEventAt: null;
    limitations: string[];
  };
  limitations: string[];
}

async function loadFromPrisma(applicationId: string): Promise<JoinedPersistenceRecord | null> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      opportunity: {
        select: {
          id: true,
          title: true,
          specialty: true,
          hiringType: true,
          state: true,
          organizationId: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!application) return null;

  const acceptance = await prisma.employerAcceptance.findFirst({
    where: { applicationId },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true, status: true, packetHash: true, acceptedAt: true },
  });
  const [attestation, auditEvents] = await Promise.all([
    acceptance
      ? prisma.startAttestation.findFirst({
          where: { acceptanceId: acceptance.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, acceptanceId: true, startedAt: true, createdAt: true },
        })
      : Promise.resolve(null),
    prisma.auditEvent.findMany({
      where: {
        referenceId: applicationId,
        type: {
          in: [
            'APPLICATION_REVIEW_STARTED',
            'APPLICATION_MISSING_INFO_REQUESTED',
            'APPLICATION_DECISION_RECORDED',
            'START_READY',
            'START_RECORDED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { type: true, createdAt: true },
    }),
  ]);

  return { application, acceptance, attestation, auditEvents };
}

const DEFAULT_DEPENDENCIES: HireToStartReadDependencies = {
  readPacket: readApplicationPacket,
  readMission: (input, authorizedPacket) => readStartMission(input, undefined, authorizedPacket),
  load: loadFromPrisma,
};

function firstAudit(record: JoinedPersistenceRecord, types: readonly string[]): Date | null {
  return record.auditEvents.find((event) => types.includes(event.type))?.createdAt ?? null;
}

function milestone(type: HireToStartMilestoneType, occurredAt: Date | null): { type: HireToStartMilestoneType; occurredAt: string } | null {
  return occurredAt ? { type, occurredAt: occurredAt.toISOString() } : null;
}

function missionOf(result: StartMissionReadResult): StartMission | null {
  return result.status === 'open' ? result.mission : null;
}

function stageOf(input: {
  applicationStatus: string;
  mission: StartMission | null;
  hasClarification: boolean;
  hasActualStart: boolean;
}): HireToStartStage {
  if (input.hasActualStart || input.mission?.state === 'started') return 'started';
  if (input.mission?.state === 'cancelled') return 'cancelled';
  if (input.applicationStatus === 'DECLINED') return 'not_proceeding';
  if (input.mission?.state === 'start_ready') return 'start_ready';
  if (input.mission) {
    if (input.mission.requirements.some((requirement) => !['met', 'waived', 'not_applicable'].includes(requirement.status))) {
      return 'requirements_in_progress';
    }
    return 'head_start_accepted';
  }
  if (input.hasClarification) return 'clarification';
  if (input.applicationStatus === 'REVIEWED') return 'employer_review';
  return 'application_submitted';
}

const NO_NEXT_ACTION: StartMission['nextAction'] = {
  kind: 'employer_review',
  owner: 'employer',
  label: 'Review the submitted application packet.',
  objectId: null,
};

function nextActionWithoutMission(stage: HireToStartStage): StartMission['nextAction'] {
  if (stage === 'not_proceeding' || stage === 'cancelled' || stage === 'started') {
    return { kind: 'none', owner: 'system', label: 'No next action is currently recorded.', objectId: null };
  }
  return NO_NEXT_ACTION;
}

export async function readHireToStartCase(
  input: ReadApplicationPacketInput,
  dependencies: HireToStartReadDependencies = DEFAULT_DEPENDENCIES,
): Promise<HireToStartReadModel> {
  // Authorization and packet integrity happen before joined state is loaded.
  const submission = await dependencies.readPacket(input);
  const [missionResult, record] = await Promise.all([
    dependencies.readMission(input, submission),
    dependencies.load(input.applicationId),
  ]);
  if (!record) throw new HttpError(404, 'Hire-to-start case not found.');

  const mission = missionOf(missionResult);
  const limitations = [...(mission?.limitations ?? [])];
  const packetLimitations: string[] = [];
  if (submission.mode === 'legacy') {
    packetLimitations.push(submission.legacyNotice ?? 'No immutable submission packet is available.');
  }
  if (mission && mission.packetBinding !== 'bound') {
    packetLimitations.push('The Start Mission is not bound to an accepted immutable packet.');
  }
  if (record.acceptance?.packetHash && submission.submittedPacket?.packetHash
    && record.acceptance.packetHash !== submission.submittedPacket.packetHash) {
    throw new HttpError(409, 'Hire-to-start packet binding is inconsistent.', 'HIRE_TO_START_BINDING_FAILED');
  }

  const startRecordedAudit = firstAudit(record, ['START_RECORDED']);
  if (startRecordedAudit && !record.attestation) {
    limitations.push('A start event exists without an employer start attestation.');
  }
  if (record.attestation && !startRecordedAudit) {
    limitations.push('An employer start attestation exists without an application start event.');
  }

  const hasClarification = record.auditEvents.some((event) => event.type === 'APPLICATION_MISSING_INFO_REQUESTED');
  const decisionState = record.application.status === 'DECLINED'
    ? 'not_proceeding' as const
    : record.acceptance
      ? 'accepted_as_head_start' as const
      : record.application.status === 'REVIEWED'
        ? 'under_review' as const
        : null;
  const decisionAt = record.acceptance?.acceptedAt
    ?? firstAudit(record, ['APPLICATION_DECISION_RECORDED'])
    ?? record.application.reviewedAt;

  const milestones = [
    milestone('application_submitted', record.application.createdAt),
    milestone('employer_first_review', firstAudit(record, ['APPLICATION_REVIEW_STARTED', 'APPLICATION_MISSING_INFO_REQUESTED', 'APPLICATION_DECISION_RECORDED']) ?? record.application.reviewedAt),
    milestone('decision_recorded', firstAudit(record, ['APPLICATION_DECISION_RECORDED'])),
    milestone('head_start_accepted', record.acceptance?.acceptedAt ?? null),
    milestone('start_ready_recorded', firstAudit(record, ['START_READY'])),
    milestone('actual_start_confirmed', record.attestation?.startedAt ?? null),
  ].filter((value): value is { type: HireToStartMilestoneType; occurredAt: string } => value !== null);
  const currentStage = stageOf({
    applicationStatus: record.application.status,
    mission,
    hasClarification,
    hasActualStart: Boolean(record.attestation),
  });

  return {
    application: {
      id: record.application.id,
      status: record.application.status,
      submittedAt: record.application.createdAt.toISOString(),
      opportunity: {
        id: record.application.opportunity.id,
        submittedVersion: submission.submittedPacket?.opportunityVersion ?? null,
        currentVersion: record.application.opportunity.updatedAt.toISOString(),
        title: record.application.opportunity.title,
        specialty: record.application.opportunity.specialty,
        hiringType: record.application.opportunity.hiringType,
        state: record.application.opportunity.state,
        organizationId: record.application.opportunity.organizationId,
      },
    },
    accessPerspective: submission.accessPerspective,
    submission,
    packetBinding: {
      state: mission?.packetBinding ?? (submission.mode === 'legacy' ? 'legacy_unbound' : 'not_opened'),
      packetVersion: submission.submittedPacket?.packetVersion ?? null,
      packetHash: submission.submittedPacket?.packetHash ?? null,
      integrity: submission.submittedPacket ? 'valid' : 'legacy_unavailable',
      limitations: packetLimitations,
    },
    decision: decisionState ? {
      state: decisionState,
      decidedAt: decisionAt?.toISOString() ?? null,
      acceptanceId: record.acceptance?.id ?? null,
      packetHash: record.acceptance?.packetHash ?? null,
      institutionReviewRemains: true,
    } : null,
    currentStage,
    intendedStartDate: mission?.intendedStartDate ?? null,
    actualStart: record.attestation ? {
      attestationId: record.attestation.id,
      actualFirstDay: record.attestation.startedAt.toISOString(),
      recordedAt: record.attestation.createdAt.toISOString(),
      employerConfirmed: true,
    } : null,
    requirements: mission?.requirements ?? [],
    blockerSummary: mission?.blockerSummary ?? [],
    primaryNextAction: mission?.nextAction ?? nextActionWithoutMission(currentStage),
    milestones,
    externalSystemSync: {
      state: 'not_configured',
      lastEventAt: null,
      limitations: ['No external ATS or credentialing event source is configured for this case.'],
    },
    limitations,
  };
}
