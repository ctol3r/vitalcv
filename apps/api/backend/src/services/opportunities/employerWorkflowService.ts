import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import {
  listAllOrgApplications,
  type MarketplaceApplication,
} from './applicationService';
import { HttpError } from '../../utils/httpError';
import { sha256ForPayload } from '../../utils/deterministic';
import { parseOrganizationRequirementsEnvelope } from '../employers/pilotPolicy';
import type { EmployerRequirementSpec } from '../employers/employerCatalog';
import {
  verifySealedPacket,
  type SealedApplicationPacket,
} from './applicationPacketService';
import {
  reconstructSealedPacket,
  type StoredApplicationPacket,
} from './applicationPacketReadService';

const REQUEST_INFO_EVENT = 'APPLICATION_MISSING_INFO_REQUESTED';
const CLOSE_REQUEST_EVENT = 'APPLICATION_MISSING_INFO_CLOSED';

export type EmployerWorkflowState =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_DOCUMENTS'
  | 'APPROVED'
  | 'REJECTED';

export type MissingRequestStatus = 'OPEN' | 'CLOSED';

export type EmployerWorkflowAction = 'start_review' | 'accept' | 'request_info' | 'reject';

export type MissingRequestInput = {
  field: string;
  message: string;
};

export type MissingRequest = {
  requestId: string;
  applicationId: string;
  field: string;
  message: string;
  status: MissingRequestStatus;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployerWorkflowApplication = MarketplaceApplication & {
  workflowState: EmployerWorkflowState;
  queue: 'applications' | 'hire_to_start' | 'closed';
  missingRequests: MissingRequest[];
};

export type EmployerWorkflowDashboard = {
  applications: EmployerWorkflowApplication[];
  byState: Record<EmployerWorkflowState, EmployerWorkflowApplication[]>;
  bottlenecks: {
    waitingForDocumentsCount: number;
    underReviewOver48HoursCount: number;
    newApplicationsCount: number;
    acceptedHeadStartCount: number;
  };
  missingData: MissingRequest[];
};

export type EmployerWorkflowActionResult = {
  action: EmployerWorkflowAction;
  application: EmployerWorkflowApplication;
  taskId: string | null;
  notificationTriggered: boolean;
  auditEventId: string | null;
  decisionOutboxEventId: string | null;
  acceptanceId: string | null;
  startActivationId: string | null;
  remainingRequirementCount: number;
};

type DecisionSubmissionBinding =
  | {
      mode: 'sealed';
      packetId: string;
      packetVersion: number;
      packetHash: string;
      packet: SealedApplicationPacket;
    }
  | {
      mode: 'legacy';
      packetId: null;
      packetVersion: null;
      packetHash: null;
      packet: null;
    };

type MissingRequestEventRecord = {
  type: string;
  referenceId: string | null;
  createdAt: Date;
  metadata: unknown;
};

type OptionalHitlWriter = {
  hITLReviewItem?: {
    create: (args: {
      data: {
        id: string;
        entityId: string;
        clinicianNpi: string;
        employerId: string;
        status: string;
        priority: 'LOW' | 'NORMAL' | 'HIGH';
        reason: string;
        createdAt: Date;
      };
    }) => Promise<{ id: string }>;
  };
};

type WorkflowTransaction = {
  application: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { id: string };
      select: { sealedPacketVersion: true };
    }) => Promise<{ sealedPacketVersion: number | null } | null>;
    updateMany: (args: {
      where: { id: string; status: { notIn: string[] } };
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  applicationPacket: {
    findFirst: (args: {
      where: { applicationId: string; packetVersion: number };
      select: Record<string, boolean>;
    }) => Promise<(StoredApplicationPacket & {
      id: string;
      revokedAt: Date | null;
      supersededByPacketId: string | null;
    }) | null>;
  };
  employerAcceptance: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  startActivation: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  activationRequirement: {
    createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<{ count: number }>;
  };
  organizationProfile: {
    findUnique: (args: {
      where: { organizationId: string };
      select: { requirements: true; updatedAt: true };
    }) => Promise<{ requirements: unknown; updatedAt: Date } | null>;
  };
  auditEvent: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  outboxEvent: {
    upsert: (args: {
      where: { dedupeKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeMissingRequestInputs(
  requests: readonly MissingRequestInput[],
): Array<{ field: string; message: string }> {
  return requests
    .map((request) => ({
      field: normalizeText(request.field, 64),
      message: normalizeText(request.message, 500),
    }))
    .filter((request): request is { field: string; message: string } => (
      Boolean(request.field) && Boolean(request.message)
    ));
}

function buildMissingRequestSummary(requests: readonly { field: string }[]): string {
  if (requests.length === 0) {
    return 'Additional information requested from clinician.';
  }

  return `Additional information requested: ${requests.map((request) => request.field).join(', ')}.`;
}

function updatedBeyond48Hours(iso: string): boolean {
  const updatedAt = Date.parse(iso);
  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt >= 48 * 60 * 60 * 1000;
}

function deriveWorkflowState(
  application: MarketplaceApplication,
  missingRequests: readonly MissingRequest[],
): EmployerWorkflowState {
  if (application.status === 'DECLINED' || application.status === 'WITHDRAWN') {
    return 'REJECTED';
  }
  if (application.status === 'ACCEPTED') {
    return 'APPROVED';
  }
  if (missingRequests.some((request) => request.status === 'OPEN')) {
    return 'WAITING_FOR_DOCUMENTS';
  }
  if (application.status === 'REVIEWED') {
    return 'UNDER_REVIEW';
  }

  return 'NEW';
}

function deriveQueue(
  workflowState: EmployerWorkflowState,
): EmployerWorkflowApplication['queue'] {
  switch (workflowState) {
    case 'APPROVED':
      return 'hire_to_start';
    case 'REJECTED':
      return 'closed';
    default:
      return 'applications';
  }
}

function buildStateBuckets(): Record<EmployerWorkflowState, EmployerWorkflowApplication[]> {
  return {
    NEW: [],
    UNDER_REVIEW: [],
    WAITING_FOR_DOCUMENTS: [],
    APPROVED: [],
    REJECTED: [],
  };
}

function readMissingRequest(metadata: unknown): MissingRequest | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const workflow = isRecord(metadata.employerWorkflow) ? metadata.employerWorkflow : null;
  const request = workflow && isRecord(workflow.missingRequest) ? workflow.missingRequest : null;
  if (!request) {
    return null;
  }

  const requestId = normalizeText(request.requestId, 120);
  const applicationId = normalizeText(request.applicationId, 120);
  const field = normalizeText(request.field, 64);
  const message = normalizeText(request.message, 500);
  const createdAt = normalizeText(request.createdAt, 64);
  const updatedAt = normalizeText(request.updatedAt, 64);
  const status = normalizeText(request.status, 24);
  const taskId = normalizeText(request.taskId, 120);

  if (!requestId || !applicationId || !field || !message || !createdAt || !updatedAt) {
    return null;
  }

  return {
    requestId,
    applicationId,
    field,
    message,
    status: status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    taskId,
    createdAt,
    updatedAt,
  };
}

function readClosedRequestIds(metadata: unknown): string[] {
  if (!isRecord(metadata)) {
    return [];
  }

  const workflow = isRecord(metadata.employerWorkflow) ? metadata.employerWorkflow : null;
  const rawIds = workflow?.closedRequestIds;
  if (!Array.isArray(rawIds)) {
    return [];
  }

  return rawIds
    .map((value) => normalizeText(value, 120))
    .filter((value): value is string => Boolean(value));
}

async function loadMissingRequestsByApplication(
  applicationIds: readonly string[],
): Promise<Map<string, MissingRequest[]>> {
  const normalizedIds = [...new Set(applicationIds.filter(Boolean))];
  const byApplication = new Map<string, Map<string, MissingRequest>>();

  normalizedIds.forEach((applicationId) => {
    byApplication.set(applicationId, new Map());
  });

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.auditEvent.findMany({
    where: {
      referenceId: { in: normalizedIds },
      type: { in: [REQUEST_INFO_EVENT, CLOSE_REQUEST_EVENT] },
    },
    select: {
      type: true,
      referenceId: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'asc' },
  }) as MissingRequestEventRecord[];

  for (const row of rows) {
    const applicationId = normalizeText(row.referenceId, 120);
    if (!applicationId) {
      continue;
    }

    const requests = byApplication.get(applicationId);
    if (!requests) {
      continue;
    }

    if (row.type === REQUEST_INFO_EVENT) {
      const request = readMissingRequest(row.metadata);
      if (!request) {
        continue;
      }

      requests.set(request.requestId, request);
      continue;
    }

    for (const requestId of readClosedRequestIds(row.metadata)) {
      const existing = requests.get(requestId);
      if (!existing) {
        continue;
      }

      requests.set(requestId, {
        ...existing,
        status: 'CLOSED',
        updatedAt: row.createdAt.toISOString(),
      });
    }
  }

  return new Map(
    [...byApplication.entries()].map(([applicationId, requests]) => [
      applicationId,
      [...requests.values()].sort((left, right) => (
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      )),
    ]),
  );
}

function buildWorkflowApplication(
  application: MarketplaceApplication,
  missingRequests: readonly MissingRequest[],
): EmployerWorkflowApplication {
  const workflowState = deriveWorkflowState(application, missingRequests);

  return {
    ...application,
    workflowState,
    queue: deriveQueue(workflowState),
    missingRequests: [...missingRequests],
  };
}

async function loadWorkflowApplicationMap(
  verifierClerkUserId: string,
): Promise<Map<string, EmployerWorkflowApplication>> {
  const applications = await listAllOrgApplications(verifierClerkUserId);
  const missingRequestsByApplication = await loadMissingRequestsByApplication(
    applications.map((application) => application.id),
  );

  return new Map(
    applications.map((application) => [
      application.id,
      buildWorkflowApplication(
        application,
        missingRequestsByApplication.get(application.id) ?? [],
      ),
    ]),
  );
}

function ensureActionableState(application: EmployerWorkflowApplication): void {
  if (application.status === 'ACCEPTED' || application.status === 'DECLINED' || application.status === 'WITHDRAWN') {
    throw new HttpError(409, 'This application is already closed.');
  }
}

function decisionAuditPayload(input: {
  action: 'accept' | 'reject';
  application: EmployerWorkflowApplication;
  reviewerClerkUserId: string;
  reviewNote: string;
  decidedAt: Date;
  submission: DecisionSubmissionBinding;
}) {
  return {
    schema: 'vitalcv.application-decision.v1',
    action: input.action,
    applicationId: input.application.id,
    opportunityId: input.application.opportunityId,
    organizationId: input.application.employer.organizationId,
    clinicianNpi: input.application.npi,
    reviewerClerkUserId: input.reviewerClerkUserId,
    reviewNote: input.reviewNote,
    decidedAt: input.decidedAt.toISOString(),
    submission: {
      mode: input.submission.mode,
      packetId: input.submission.packetId,
      packetVersion: input.submission.packetVersion,
      packetHash: input.submission.packetHash,
    },
  };
}

type DecisionSubmissionExpectation = {
  action: 'accept' | 'reject';
  expectedPacketVersion?: number;
  expectedPacketHash?: string;
  clinicianNpi: string | null;
  clinicianClerkUserId: string;
  opportunityId: string;
  organizationId: string;
};

const PACKET_SELECT = {
  id: true,
  applicationId: true,
  packetVersion: true,
  clerkUserId: true,
  clinicianNpi: true,
  opportunityId: true,
  employerOrgId: true,
  purpose: true,
  recipient: true,
  selectedSections: true,
  fields: true,
  sectionAbsences: true,
  clinicianNote: true,
  methodologyVersion: true,
  consentAt: true,
  consentReceiptId: true,
  consentGrantId: true,
  opportunityVersion: true,
  packetHash: true,
  supersededByPacketId: true,
  revokedAt: true,
  revokedReason: true,
} as const;

function packetIntegrityFailure(message = 'The submitted application packet failed integrity verification.'): HttpError {
  return new HttpError(409, message, 'APPLICATION_PACKET_INTEGRITY_FAILED');
}

async function resolveDecisionSubmissionBinding(
  tx: WorkflowTransaction,
  applicationId: string,
  expectation: DecisionSubmissionExpectation,
): Promise<DecisionSubmissionBinding> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: { sealedPacketVersion: true },
  });
  if (!application) {
    throw new HttpError(404, 'Application not found.');
  }

  if (application.sealedPacketVersion === null) {
    if (expectation.action === 'accept') {
      throw new HttpError(
        409,
        'Legacy application — no immutable disclosure packet was captured at submission. It cannot be accepted as a head start.',
        'APPLICATION_PACKET_REQUIRED',
      );
    }
    return {
      mode: 'legacy',
      packetId: null,
      packetVersion: null,
      packetHash: null,
      packet: null,
    };
  }

  if (expectation.action === 'accept') {
    if (!Number.isInteger(expectation.expectedPacketVersion) || !expectation.expectedPacketHash?.trim()) {
      throw new HttpError(400, 'packetVersion and packetHash are required to accept as a head start.');
    }
    if (expectation.expectedPacketVersion !== application.sealedPacketVersion) {
      throw packetIntegrityFailure('The reviewed packet version is not the application\'s attached submission.');
    }
  }

  const packet = await tx.applicationPacket.findFirst({
    where: {
      applicationId,
      packetVersion: application.sealedPacketVersion,
    },
    select: PACKET_SELECT,
  });
  if (!packet) {
    // A sealed version with no stored packet is an integrity ambiguity. Do
    // not record a decision that a future dispatcher could misbind.
    throw new HttpError(409, 'The submitted application packet is unavailable.');
  }

  if (packet.revokedAt || packet.supersededByPacketId) {
    throw packetIntegrityFailure('The submitted application packet is no longer active.');
  }

  let reconstructed: SealedApplicationPacket;
  try {
    reconstructed = reconstructSealedPacket(packet);
  } catch {
    throw packetIntegrityFailure();
  }

  if (!verifySealedPacket(reconstructed)) {
    throw packetIntegrityFailure();
  }

  if (
    reconstructed.applicationId !== applicationId
    || reconstructed.opportunityId !== expectation.opportunityId
    || reconstructed.employerOrgId !== expectation.organizationId
    || reconstructed.clerkUserId !== expectation.clinicianClerkUserId
    || (expectation.clinicianNpi !== null && reconstructed.clinicianNpi !== expectation.clinicianNpi)
  ) {
    throw packetIntegrityFailure('The submitted packet does not belong to this application.');
  }

  if (
    expectation.expectedPacketHash !== undefined
    && expectation.expectedPacketHash.trim() !== reconstructed.packetHash
  ) {
    throw packetIntegrityFailure('The reviewed packet hash no longer matches the attached submission.');
  }

  return {
    mode: 'sealed',
    packetId: packet.id,
    packetVersion: packet.packetVersion,
    packetHash: packet.packetHash,
    packet: reconstructed,
  };
}

type StartUrgency = 'routine' | 'priority' | 'critical';

function parseIntendedStartDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'intendedStartDate must be a valid ISO-8601 timestamp.');
  }
  return parsed;
}

function normalizeStartUrgency(value: string | null | undefined): StartUrgency {
  if (value === undefined || value === null || value.trim() === '') return 'routine';
  if (value === 'routine' || value === 'priority' || value === 'critical') return value;
  throw new HttpError(400, 'urgency must be routine, priority, or critical.');
}

function acceptedPacketEvidenceKeys(packet: SealedApplicationPacket): Set<string> {
  return new Set(packet.fields
    .filter((field) => (
      field.value !== null
      && (field.evidenceState === 'source_backed'
        || field.evidenceState === 'checked'
        || field.evidenceState === 'employer_decided')
    ))
    .map((field) => field.fieldId));
}

function remainingRequirementRows(input: {
  applicationId: string;
  organizationId: string;
  requirements: readonly EmployerRequirementSpec[];
  packet: SealedApplicationPacket;
  policyVersion: string;
}): Array<Record<string, unknown>> {
  const acceptedKeys = acceptedPacketEvidenceKeys(input.packet);

  return input.requirements
    // Only an exact, explicit requirement key may be satisfied by the accepted
    // packet. Labels and source names are not interchangeable identifiers and
    // must never be guessed into a favorable state.
    .filter((requirement) => !requirement.key || !acceptedKeys.has(requirement.key))
    .map((requirement) => ({
      id: randomUUID(),
      applicationId: input.applicationId,
      organizationId: input.organizationId,
      sourceRequirementId: requirement.key ?? null,
      category: 'evidence',
      label: requirement.label,
      necessity: requirement.priority === 'preferred' ? 'preferred' : 'required',
      status: 'not_started',
      owner: 'both',
      evidenceRule: requirement.note ?? null,
      dependencyIds: [],
      dueAt: null,
      resolvedBy: null,
      resolvedAt: null,
      policyVersion: input.policyVersion,
    }));
}

async function closeOpenMissingRequests(input: {
  tx: WorkflowTransaction;
  application: EmployerWorkflowApplication;
  action: 'accept' | 'reject';
  now: Date;
}): Promise<void> {
  const openRequests = input.application.missingRequests.filter((request) => request.status === 'OPEN');
  if (openRequests.length === 0) {
    return;
  }

  const payload = {
    action: input.action,
    applicationId: input.application.id,
    closedRequestIds: openRequests.map((request) => request.requestId),
    closedAt: input.now.toISOString(),
  };

  await input.tx.auditEvent.create({
    data: {
      type: CLOSE_REQUEST_EVENT,
      hash: sha256ForPayload(payload),
      referenceId: input.application.id,
      clinicianId: input.application.npi ?? null,
      organizationId: input.application.employer.organizationId,
      metadata: {
        employerWorkflow: payload,
      },
    },
  });
}

export async function listEmployerWorkflowDashboard(
  verifierClerkUserId: string,
): Promise<EmployerWorkflowDashboard> {
  const applications = [...(await loadWorkflowApplicationMap(verifierClerkUserId)).values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const byState = buildStateBuckets();

  applications.forEach((application) => {
    byState[application.workflowState].push(application);
  });

  return {
    applications,
    byState,
    bottlenecks: {
      waitingForDocumentsCount: byState.WAITING_FOR_DOCUMENTS.length,
      underReviewOver48HoursCount: applications.filter((application) => (
        application.workflowState === 'UNDER_REVIEW' && updatedBeyond48Hours(application.updatedAt)
      )).length,
      newApplicationsCount: byState.NEW.length,
      acceptedHeadStartCount: byState.APPROVED.length,
    },
    missingData: applications
      .flatMap((application) => application.missingRequests)
      .filter((request) => request.status === 'OPEN')
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
  };
}

export async function getEmployerWorkflowApplication(
  applicationId: string,
  verifierClerkUserId: string,
): Promise<EmployerWorkflowApplication> {
  const applications = await loadWorkflowApplicationMap(verifierClerkUserId);
  const application = applications.get(applicationId);
  if (!application) {
    throw new HttpError(404, 'Application not found.');
  }

  return application;
}

export async function runEmployerWorkflowAction(input: {
  action: EmployerWorkflowAction;
  applicationId: string;
  reviewerClerkUserId: string;
  requests?: readonly MissingRequestInput[];
  reviewNote?: string;
  packetVersion?: number;
  packetHash?: string;
  intendedStartDate?: string | null;
  urgency?: string | null;
}): Promise<EmployerWorkflowActionResult> {
  const application = await getEmployerWorkflowApplication(input.applicationId, input.reviewerClerkUserId);
  ensureActionableState(application);

  const now = new Date();

  if (input.action === 'start_review') {
    const reviewNote = normalizeText(input.reviewNote, 500) ?? 'Employer review started.';
    let auditEventId: string | null = null;

    await prisma.$transaction(async (tx: unknown) => {
      const workflowTx = tx as unknown as WorkflowTransaction;
      await workflowTx.application.update({
        where: { id: application.id },
        data: {
          status: 'REVIEWED',
          reviewedBy: input.reviewerClerkUserId,
          reviewedAt: now,
          reviewNote,
        },
      });

      const auditEvent = await workflowTx.auditEvent.create({
        data: {
          type: 'APPLICATION_REVIEW_STARTED',
          hash: sha256ForPayload({
            schema: 'vitalcv.application-review-started.v1',
            applicationId: application.id,
            reviewerClerkUserId: input.reviewerClerkUserId,
            reviewNote,
            reviewedAt: now.toISOString(),
          }),
          referenceId: application.id,
          clinicianId: application.npi ?? null,
          organizationId: application.employer.organizationId,
          metadata: {
            employerWorkflow: {
              action: 'start_review',
              reviewerClerkUserId: input.reviewerClerkUserId,
              reviewNote,
              reviewedAt: now.toISOString(),
            },
          },
        },
      });
      auditEventId = (auditEvent as { id?: string }).id ?? null;
    });

    const updatedApplication = await getEmployerWorkflowApplication(
      application.id,
      input.reviewerClerkUserId,
    );

    return {
      action: 'start_review',
      application: updatedApplication,
      taskId: null,
      notificationTriggered: false,
      auditEventId,
      decisionOutboxEventId: null,
      acceptanceId: null,
      startActivationId: null,
      remainingRequirementCount: 0,
    };
  }

  if (input.action === 'request_info') {
    const requests = normalizeMissingRequestInputs(input.requests ?? []);
    if (requests.length === 0) {
      throw new HttpError(400, 'At least one missing field request is required.');
    }

    const summary = normalizeText(input.reviewNote, 500) ?? buildMissingRequestSummary(requests);
    let taskId: string | null = null;

    await prisma.$transaction(async (tx: unknown) => {
      const workflowTx = tx as unknown as WorkflowTransaction & OptionalHitlWriter;
      const task = await workflowTx.hITLReviewItem?.create({
        data: {
          id: randomUUID(),
          entityId: application.id,
          clinicianNpi: application.npi ?? 'unknown',
          employerId: application.employer.organizationId,
          status: 'PENDING',
          priority: 'HIGH',
          reason: summary,
          createdAt: now,
        },
      });
      taskId = task?.id ?? null;

      await workflowTx.application.update({
        where: { id: application.id },
        data: {
          status: 'REVIEWED',
          reviewedBy: input.reviewerClerkUserId,
          reviewedAt: now,
          reviewNote: summary,
        },
      });

      for (const request of requests) {
        const missingRequest: MissingRequest = {
          requestId: randomUUID(),
          applicationId: application.id,
          field: request.field,
          message: request.message,
          status: 'OPEN',
          taskId,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        await workflowTx.auditEvent.create({
          data: {
            type: REQUEST_INFO_EVENT,
            hash: sha256ForPayload({
              action: 'request_info',
              applicationId: application.id,
              missingRequest,
            }),
            referenceId: application.id,
            clinicianId: application.npi ?? null,
            organizationId: application.employer.organizationId,
            metadata: {
              employerWorkflow: {
                action: 'request_info',
                missingRequest,
              },
            },
          },
        });
      }
    });

    const updatedApplication = await getEmployerWorkflowApplication(
      application.id,
      input.reviewerClerkUserId,
    );

    return {
      action: 'request_info',
      application: updatedApplication,
      taskId,
      notificationTriggered: true,
      auditEventId: null,
      decisionOutboxEventId: null,
      acceptanceId: null,
      startActivationId: null,
      remainingRequirementCount: 0,
    };
  }

  const decisionAction = input.action === 'accept' ? 'accept' : 'reject';
  const nextStatus = decisionAction === 'accept' ? 'ACCEPTED' : 'DECLINED';
  const nextReviewNote = normalizeText(input.reviewNote, 500)
    ?? (decisionAction === 'accept'
      ? 'Accepted as a head start; institution review remains.'
      : 'Application rejected.');

  let auditEventId: string | null = null;
  let decisionOutboxEventId: string | null = null;
  let acceptanceId: string | null = null;
  let startActivationId: string | null = null;
  let remainingRequirementCount = 0;
  const intendedStartDate = decisionAction === 'accept'
    ? parseIntendedStartDate(input.intendedStartDate)
    : null;
  const urgency = decisionAction === 'accept'
    ? normalizeStartUrgency(input.urgency)
    : 'routine';

  await prisma.$transaction(async (tx: unknown) => {
    const workflowTx = tx as unknown as WorkflowTransaction;
    const submission = await resolveDecisionSubmissionBinding(
      workflowTx,
      application.id,
      {
        action: decisionAction,
        expectedPacketVersion: input.packetVersion,
        expectedPacketHash: input.packetHash,
        clinicianNpi: application.npi,
        clinicianClerkUserId: application.clerkUserId,
        opportunityId: application.opportunityId,
        organizationId: application.employer.organizationId,
      },
    );

    // The status predicate is the concurrency gate. Two actors may load the
    // same open application, but only one transaction may close it; the loser
    // records no acceptance, activation, audit, or outbox consequence.
    const transition = await workflowTx.application.updateMany({
      where: {
        id: application.id,
        status: { notIn: ['ACCEPTED', 'DECLINED', 'WITHDRAWN'] },
      },
      data: {
        status: nextStatus,
        reviewedBy: input.reviewerClerkUserId,
        reviewedAt: now,
        reviewNote: nextReviewNote,
      },
    });
    if (transition.count !== 1) {
      throw new HttpError(409, 'This application is already closed.');
    }

    if (decisionAction === 'accept') {
      if (submission.mode !== 'sealed') {
        throw new HttpError(409, 'A sealed packet is required for head-start acceptance.');
      }

      const acceptance = await workflowTx.employerAcceptance.create({
        data: {
          id: randomUUID(),
          organization: application.employer.name,
          employerId: application.employer.organizationId,
          clinicianNpi: submission.packet.clinicianNpi,
          applicationId: application.id,
          packetHash: submission.packetHash,
          status: 'ACCEPTED',
          acceptedAt: now,
          acceptedBy: input.reviewerClerkUserId,
          metadata: {
            schema: 'vitalcv.employer-head-start-acceptance.v1',
            packetId: submission.packetId,
            packetVersion: submission.packetVersion,
            opportunityId: application.opportunityId,
            decisionMeaning: 'accepted_as_head_start',
            institutionReviewRemains: true,
          },
        },
      });
      acceptanceId = acceptance.id;

      const organizationProfile = await workflowTx.organizationProfile.findUnique({
        where: { organizationId: application.employer.organizationId },
        select: { requirements: true, updatedAt: true },
      });
      const requirementSpecs = parseOrganizationRequirementsEnvelope(
        organizationProfile?.requirements,
        [],
      ).requirements;
      const policyVersion = organizationProfile
        ? `organization_requirements:${organizationProfile.updatedAt.toISOString()}`
        : 'organization_requirements:unavailable';
      const remainingRequirements = remainingRequirementRows({
        applicationId: application.id,
        organizationId: application.employer.organizationId,
        requirements: requirementSpecs,
        packet: submission.packet,
        policyVersion,
      });

      if (remainingRequirements.length > 0) {
        const created = await workflowTx.activationRequirement.createMany({
          data: remainingRequirements,
        });
        remainingRequirementCount = created.count;
      }

      const activation = await workflowTx.startActivation.create({
        data: {
          id: randomUUID(),
          clinicianNpi: submission.packet.clinicianNpi,
          orgId: application.employer.organizationId,
          acceptanceId: acceptance.id,
          role: application.opportunity.title,
          activationState: 'head_start_accepted',
          activatedAt: now,
          applicationId: application.id,
          opportunityId: application.opportunityId,
          acceptedPacketId: submission.packetId,
          acceptedPacketHash: submission.packetHash,
          intendedStartDate,
          urgency,
          policyVersion,
          metadata: {
            schema: 'vitalcv.start-mission.activation.v1',
            packetVersion: submission.packetVersion,
            remainingRequirementCount,
            credentialingCompletionInferred: false,
            institutionReviewRemains: true,
          },
        },
      });
      startActivationId = activation.id;

      const requirementsAuditPayload = {
        schema: 'vitalcv.activation-requirements-instantiated.v1',
        applicationId: application.id,
        acceptanceId: acceptance.id,
        startActivationId: activation.id,
        packetId: submission.packetId,
        packetHash: submission.packetHash,
        remainingRequirementCount,
        policyVersion,
      };
      await workflowTx.auditEvent.create({
        data: {
          type: 'ACTIVATION_REQUIREMENTS_INSTANTIATED',
          hash: sha256ForPayload(requirementsAuditPayload),
          referenceId: application.id,
          clinicianId: submission.packet.clinicianNpi,
          organizationId: application.employer.organizationId,
          metadata: { employerWorkflow: requirementsAuditPayload },
        },
      });
    }

    await closeOpenMissingRequests({
      tx: workflowTx,
      application,
      action: decisionAction,
      now,
    });

    const decisionPayload = {
      ...decisionAuditPayload({
        action: decisionAction,
        application,
        reviewerClerkUserId: input.reviewerClerkUserId,
        reviewNote: nextReviewNote,
        decidedAt: now,
        submission,
      }),
      consequences: {
        acceptanceId,
        startActivationId,
        remainingRequirementCount,
      },
    };
    const auditEvent = await workflowTx.auditEvent.create({
      data: {
        type: 'APPLICATION_DECISION_RECORDED',
        hash: sha256ForPayload(decisionPayload),
        referenceId: application.id,
        clinicianId: application.npi ?? null,
        organizationId: application.employer.organizationId,
        metadata: { employerWorkflow: decisionPayload },
      },
    });
    auditEventId = (auditEvent as { id?: string }).id ?? null;

    // A capsule is a required consequence of an employer decision. The
    // outbox makes that intent durable in the same transaction as the state
    // transition and audit record; a delivery worker may process it later.
    const decisionOutbox = await workflowTx.outboxEvent.upsert({
      where: {
        dedupeKey: `APPLICATION_DECISION_CAPSULE_REQUESTED:${application.id}:${nextStatus}`,
      },
      create: {
        eventType: 'APPLICATION_DECISION_CAPSULE_REQUESTED',
        aggregateType: 'APPLICATION',
        aggregateId: application.id,
        payload: decisionPayload,
        dedupeKey: `APPLICATION_DECISION_CAPSULE_REQUESTED:${application.id}:${nextStatus}`,
        status: 'PENDING',
        attemptCount: 0,
        availableAt: now,
      },
      update: {
        payload: decisionPayload,
        status: 'PENDING',
        availableAt: now,
        lastError: null,
      },
    });
    decisionOutboxEventId = decisionOutbox.id;
  });

  const updatedApplication = await getEmployerWorkflowApplication(
    application.id,
    input.reviewerClerkUserId,
  );

  return {
    action: input.action,
    application: updatedApplication,
    taskId: null,
    notificationTriggered: true,
    auditEventId,
    decisionOutboxEventId,
    acceptanceId,
    startActivationId,
    remainingRequirementCount,
  };
}
