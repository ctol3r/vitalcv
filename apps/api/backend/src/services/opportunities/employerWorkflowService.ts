import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import {
  listAllOrgApplications,
  type MarketplaceApplication,
} from './applicationService';
import { HttpError } from '../../utils/httpError';
import { sha256ForPayload } from '../../utils/deterministic';

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
  queue: 'applications' | 'credentialing' | 'closed';
  missingRequests: MissingRequest[];
};

export type EmployerWorkflowDashboard = {
  applications: EmployerWorkflowApplication[];
  byState: Record<EmployerWorkflowState, EmployerWorkflowApplication[]>;
  bottlenecks: {
    waitingForDocumentsCount: number;
    underReviewOver48HoursCount: number;
    newApplicationsCount: number;
    approvedForCredentialingCount: number;
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
};

type DecisionSubmissionBinding = {
  mode: 'sealed' | 'legacy';
  packetVersion: number | null;
  packetHash: string | null;
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
  };
  applicationPacket: {
    findFirst: (args: {
      where: { applicationId: string; packetVersion: number };
      select: { packetVersion: true; packetHash: true };
    }) => Promise<{ packetVersion: number; packetHash: string } | null>;
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
      return 'credentialing';
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
    submission: input.submission,
  };
}

async function resolveDecisionSubmissionBinding(
  tx: WorkflowTransaction,
  applicationId: string,
): Promise<DecisionSubmissionBinding> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: { sealedPacketVersion: true },
  });
  if (!application) {
    throw new HttpError(404, 'Application not found.');
  }

  if (application.sealedPacketVersion === null) {
    return {
      mode: 'legacy',
      packetVersion: null,
      packetHash: null,
    };
  }

  const packet = await tx.applicationPacket.findFirst({
    where: {
      applicationId,
      packetVersion: application.sealedPacketVersion,
    },
    select: {
      packetVersion: true,
      packetHash: true,
    },
  });
  if (!packet) {
    // A sealed version with no stored packet is an integrity ambiguity. Do
    // not record a decision that a future dispatcher could misbind.
    throw new HttpError(409, 'The submitted application packet is unavailable.');
  }

  return {
    mode: 'sealed',
    packetVersion: packet.packetVersion,
    packetHash: packet.packetHash,
  };
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
      approvedForCredentialingCount: byState.APPROVED.length,
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
    };
  }

  const decisionAction = input.action === 'accept' ? 'accept' : 'reject';
  const nextStatus = decisionAction === 'accept' ? 'ACCEPTED' : 'DECLINED';
  const nextReviewNote = normalizeText(input.reviewNote, 500)
    ?? (decisionAction === 'accept'
      ? 'Approved and moved to credentialing.'
      : 'Application rejected.');

  let auditEventId: string | null = null;
  let decisionOutboxEventId: string | null = null;

  await prisma.$transaction(async (tx: unknown) => {
    const workflowTx = tx as unknown as WorkflowTransaction;
    const submission = await resolveDecisionSubmissionBinding(
      workflowTx,
      application.id,
    );

    await workflowTx.application.update({
      where: { id: application.id },
      data: {
        status: nextStatus,
        reviewedBy: input.reviewerClerkUserId,
        reviewedAt: now,
        reviewNote: nextReviewNote,
      },
    });

    await closeOpenMissingRequests({
      tx: workflowTx,
      application,
      action: input.action as any,
      now,
    });

    const decisionPayload = decisionAuditPayload({
      action: decisionAction,
      application,
      reviewerClerkUserId: input.reviewerClerkUserId,
      reviewNote: nextReviewNote,
      decidedAt: now,
      submission,
    });
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
  };
}
