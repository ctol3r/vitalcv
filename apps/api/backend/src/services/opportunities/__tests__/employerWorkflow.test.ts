jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    auditEvent: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../applicationService', () => ({
  listAllOrgApplications: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { listAllOrgApplications } from '../applicationService';
import { runEmployerWorkflowAction } from '../employerWorkflowService';

const prismaMock = prisma as unknown as {
  auditEvent: {
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

const listAllOrgApplicationsMock =
  listAllOrgApplications as jest.MockedFunction<typeof listAllOrgApplications>;

function buildApplication(overrides?: Record<string, unknown>) {
  return {
    id: 'app-1',
    opportunityId: 'opp-1',
    clerkUserId: 'clinician-1',
    npi: '1234567890',
    coverNote: null,
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
    provider: {
      npi: '1234567890',
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      specialty: 'ICU',
      stateOfPractice: 'OR',
    },
    employer: {
      organizationId: 'org-1',
      name: 'Providence',
    },
    readiness: {
      readinessScore: 91,
      readinessLevel: 'L3',
      readinessStatus: 'Ready to credential',
      gapSummary: [],
      keyCredentials: ['Oregon license'],
      trustSignals: ['NPI identity verified'],
    },
    latestRecommendation: null,
    timeline: [],
    systemBehavesAutonomously: false,
    opportunity: {
      id: 'opp-1',
      organizationId: 'org-1',
      organizationName: 'Providence',
      title: 'Travel ICU Nurse',
      specialty: 'ICU',
      hiringType: 'contract',
      state: 'OR',
      payRange: '$3,600/week',
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

describe('Employer Workflow Actions', () => {
  beforeEach(() => {
    prismaMock.auditEvent.findMany.mockReset();
    prismaMock.$transaction.mockReset();
    listAllOrgApplicationsMock.mockReset();
  });

  test('request info creates task', async () => {
    const initialApplication = buildApplication();
    const updatedApplication = buildApplication({
      status: 'REVIEWED',
      reviewedBy: 'verifier-1',
      reviewedAt: '2026-04-09T12:00:00.000Z',
      reviewNote: 'Additional information requested: state license.',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });

    listAllOrgApplicationsMock
      .mockResolvedValueOnce([initialApplication] as never)
      .mockResolvedValueOnce([updatedApplication] as never);

    prismaMock.auditEvent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'APPLICATION_MISSING_INFO_REQUESTED',
          referenceId: 'app-1',
          createdAt: new Date('2026-04-09T12:00:00.000Z'),
          metadata: {
            employerWorkflow: {
              action: 'request_info',
              missingRequest: {
                requestId: 'missing-1',
                applicationId: 'app-1',
                field: 'state license',
                message: 'Upload your active Oregon license.',
                status: 'OPEN',
                taskId: 'task-1',
                createdAt: '2026-04-09T12:00:00.000Z',
                updatedAt: '2026-04-09T12:00:00.000Z',
              },
            },
          },
        },
      ]);

    const transactionClient = {
      application: {
        update: jest.fn().mockResolvedValue({}),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      hITLReviewItem: {
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient));

    const result = await runEmployerWorkflowAction({
      action: 'request_info',
      applicationId: 'app-1',
      reviewerClerkUserId: 'verifier-1',
      requests: [
        {
          field: 'state license',
          message: 'Upload your active Oregon license.',
        },
      ],
    });

    expect(transactionClient.hITLReviewItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityId: 'app-1',
        clinicianNpi: '1234567890',
        employerId: 'org-1',
        status: 'PENDING',
      }),
    }));
    expect(result.taskId).toBe('task-1');
    expect(result.application.workflowState).toBe('WAITING_FOR_DOCUMENTS');
  });

  test('accept moves to credentialing', async () => {
    const initialApplication = buildApplication({
      status: 'REVIEWED',
      reviewedBy: 'verifier-1',
      reviewedAt: '2026-04-09T11:00:00.000Z',
      reviewNote: 'Additional information requested: state license.',
      updatedAt: '2026-04-09T11:00:00.000Z',
    });
    const acceptedApplication = buildApplication({
      status: 'ACCEPTED',
      reviewedBy: 'verifier-1',
      reviewedAt: '2026-04-09T13:00:00.000Z',
      reviewNote: 'Approved and moved to credentialing.',
      updatedAt: '2026-04-09T13:00:00.000Z',
    });

    listAllOrgApplicationsMock
      .mockResolvedValueOnce([initialApplication] as never)
      .mockResolvedValueOnce([acceptedApplication] as never);

    prismaMock.auditEvent.findMany
      .mockResolvedValueOnce([
        {
          type: 'APPLICATION_MISSING_INFO_REQUESTED',
          referenceId: 'app-1',
          createdAt: new Date('2026-04-09T11:00:00.000Z'),
          metadata: {
            employerWorkflow: {
              action: 'request_info',
              missingRequest: {
                requestId: 'missing-1',
                applicationId: 'app-1',
                field: 'state license',
                message: 'Upload your active Oregon license.',
                status: 'OPEN',
                taskId: 'task-1',
                createdAt: '2026-04-09T11:00:00.000Z',
                updatedAt: '2026-04-09T11:00:00.000Z',
              },
            },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          type: 'APPLICATION_MISSING_INFO_REQUESTED',
          referenceId: 'app-1',
          createdAt: new Date('2026-04-09T11:00:00.000Z'),
          metadata: {
            employerWorkflow: {
              action: 'request_info',
              missingRequest: {
                requestId: 'missing-1',
                applicationId: 'app-1',
                field: 'state license',
                message: 'Upload your active Oregon license.',
                status: 'OPEN',
                taskId: 'task-1',
                createdAt: '2026-04-09T11:00:00.000Z',
                updatedAt: '2026-04-09T11:00:00.000Z',
              },
            },
          },
        },
        {
          type: 'APPLICATION_MISSING_INFO_CLOSED',
          referenceId: 'app-1',
          createdAt: new Date('2026-04-09T13:00:00.000Z'),
          metadata: {
            employerWorkflow: {
              action: 'accept',
              applicationId: 'app-1',
              closedRequestIds: ['missing-1'],
              closedAt: '2026-04-09T13:00:00.000Z',
            },
          },
        },
      ]);

    const transactionClient = {
      application: {
        update: jest.fn().mockResolvedValue({}),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-decision-1' }),
      },
      outboxEvent: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-decision-1' }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient));

    const result = await runEmployerWorkflowAction({
      action: 'accept',
      applicationId: 'app-1',
      reviewerClerkUserId: 'verifier-1',
    });

    expect(transactionClient.application.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'app-1' },
      data: expect.objectContaining({
        status: 'ACCEPTED',
      }),
    }));
    expect(result.application.workflowState).toBe('APPROVED');
    expect(result.application.queue).toBe('credentialing');
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'APPLICATION_DECISION_RECORDED',
        referenceId: 'app-1',
      }),
    }));
    expect(transactionClient.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        dedupeKey: 'APPLICATION_DECISION_CAPSULE_REQUESTED:app-1:ACCEPTED',
      },
    }));
    expect(result.auditEventId).toBe('audit-decision-1');
    expect(result.decisionOutboxEventId).toBe('outbox-decision-1');
  });

  test('starts review through the canonical workflow command', async () => {
    const initialApplication = buildApplication();
    const reviewedApplication = buildApplication({
      status: 'REVIEWED',
      reviewedBy: 'verifier-1',
      reviewedAt: '2026-04-09T12:00:00.000Z',
      reviewNote: 'Review started.',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });

    listAllOrgApplicationsMock
      .mockResolvedValueOnce([initialApplication] as never)
      .mockResolvedValueOnce([reviewedApplication] as never);
    prismaMock.auditEvent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const transactionClient = {
      application: {
        update: jest.fn().mockResolvedValue({}),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-review-1' }),
      },
      outboxEvent: {
        upsert: jest.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient));

    const result = await runEmployerWorkflowAction({
      action: 'start_review',
      applicationId: 'app-1',
      reviewerClerkUserId: 'verifier-1',
      reviewNote: 'Review started.',
    });

    expect(transactionClient.application.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REVIEWED' }),
    }));
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'APPLICATION_REVIEW_STARTED' }),
    }));
    expect(transactionClient.outboxEvent.upsert).not.toHaveBeenCalled();
    expect(result.action).toBe('start_review');
    expect(result.auditEventId).toBe('audit-review-1');
  });
});
