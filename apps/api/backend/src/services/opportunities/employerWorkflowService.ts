import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
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

export type EmployerWorkflowAction = 'accept' | 'request_info' | 'reject';

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
      data: Prisma.ApplicationUncheckedUpdateInput;
    }) => Promise<unknown>;
  };
  auditEvent: {
    create: (args: {
      data: Prisma.AuditEventUncheckedCreateInput;
    }) => Promise<unknown>;
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

async function closeOpenMissingRequests(input: {
  tx: WorkflowTransaction;
  application: EmployerWorkflowApplication;
  action: EmployerWorkflowAction;
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

  if (input.action === 'request_info') {
    const requests = normalizeMissingRequestInputs(input.requests ?? []);
    if (requests.length === 0) {
      throw new HttpError(400, 'At least one missing field request is required.');
    }

    const summary = normalizeText(input.reviewNote, 500) ?? buildMissingRequestSummary(requests);
    let taskId: string | null = null;

    await prisma.$transaction(async (tx) => {
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
    };
  }

  const nextStatus = input.action === 'accept' ? 'ACCEPTED' : 'DECLINED';
  const nextReviewNote = normalizeText(input.reviewNote, 500)
    ?? (input.action === 'accept'
      ? 'Approved and moved to credentialing.'
      : 'Application rejected.');

  await prisma.$transaction(async (tx) => {
    const workflowTx = tx as unknown as WorkflowTransaction;

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
      action: input.action,
      now,
    });
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
  };
}
