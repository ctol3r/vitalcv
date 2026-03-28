jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvOrganizationContext: {
      findUnique: jest.fn(),
    },
    vcvOrgContextSubject: {
      findUnique: jest.fn(),
    },
    bundleShareEvent: {
      findFirst: jest.fn(),
    },
    employerAcceptance: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    outboxEvent: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../passportService', () => ({
  buildPassportByNpi: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../trust/trustScoreV1', () => ({
  computeTrustScoreV1: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  loadEmployerReviewStatus,
  recordEmployerReviewAcceptance,
} from '../employerReviewActions';

const prismaMock = prisma as unknown as {
  vcvOrganizationContext: {
    findUnique: jest.Mock;
  };
  vcvOrgContextSubject: {
    findUnique: jest.Mock;
  };
  bundleShareEvent: {
    findFirst: jest.Mock;
  };
  employerAcceptance: {
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  outboxEvent: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('employerReviewActions service', () => {
  beforeEach(() => {
    prismaMock.vcvOrganizationContext.findUnique.mockReset();
    prismaMock.vcvOrgContextSubject.findUnique.mockReset();
    prismaMock.bundleShareEvent.findFirst.mockReset();
    prismaMock.employerAcceptance.create.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.auditEvent.findMany.mockReset();
    prismaMock.outboxEvent.upsert.mockReset();
    prismaMock.$transaction.mockReset();

    prismaMock.vcvOrganizationContext.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'ctx-1') {
        return {
          id: 'ctx-1',
          requestorId: 'org-entity-1',
          contextType: 'EMPLOYMENT_REVIEW',
          status: 'PENDING',
          title: 'Employment review',
          description: null,
          webhookUrl: null,
          requestor: {
            id: 'org-entity-1',
            displayName: 'Providence',
          },
        };
      }

      return null;
    });
    prismaMock.vcvOrgContextSubject.findUnique.mockResolvedValue({
      id: 'ctx-subject-1',
    });
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      id: 'share-1',
      bundleId: 'bundle-1',
      subjectEntityId: 'entity-1',
      organizationContextId: 'ctx-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      purposeOfUse: 'Employment review',
    });
    prismaMock.employerAcceptance.create.mockResolvedValue({
      id: 'accept-1',
      acceptedAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.auditEvent.create.mockResolvedValue({
      id: 'audit-1',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.outboxEvent.upsert.mockResolvedValue({
      id: 'outbox-1',
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it('persists explicit organization-context attribution onto acceptance audit events', async () => {
    const state = await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(state.attribution).toEqual({
      source: 'organization_context',
      organizationContextId: 'ctx-1',
      bundleShareEventId: null,
      bundleId: null,
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      purposeOfUse: 'Employment review',
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: 'accept-1',
        organizationId: 'org-entity-1',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            attribution: expect.objectContaining({
              source: 'organization_context',
              organizationContextId: 'ctx-1',
              organizationId: 'org-entity-1',
            }),
          }),
        }),
      }),
    }));
  });

  it('persists bundle fallback attribution onto acceptance audit events using the canonical organization context', async () => {
    const state = await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      bundleId: 'bundle-1',
    });

    expect(state.attribution).toEqual({
      source: 'bundle_share',
      organizationContextId: 'ctx-1',
      bundleShareEventId: 'share-1',
      bundleId: 'bundle-1',
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      purposeOfUse: 'Employment review',
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: 'accept-1',
        organizationId: 'org-entity-1',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            attribution: expect.objectContaining({
              source: 'bundle_share',
              organizationContextId: 'ctx-1',
              bundleShareEventId: 'share-1',
              bundleId: 'bundle-1',
              organizationId: 'org-entity-1',
            }),
          }),
        }),
      }),
    }));
  });

  it('keeps review continuity between bundle fallback and employer-request context', async () => {
    prismaMock.bundleShareEvent.findFirst
      .mockResolvedValueOnce({
        id: 'share-1',
        bundleId: 'bundle-1',
        subjectEntityId: 'entity-1',
        organizationContextId: 'ctx-1',
        organizationId: 'legacy-org',
        organizationName: 'Legacy Providence',
        purposeOfUse: 'Legacy employment review',
      })
      .mockResolvedValueOnce({
        id: 'share-1',
      });
    prismaMock.auditEvent.findMany.mockResolvedValue([{
      id: 'audit-accept-1',
      createdAt: new Date('2026-03-23T19:46:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'accept',
          employerId: 'employer-1',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          requestId: 'req-accept-1',
          attribution: {
            source: 'organization_context',
            organizationContextId: 'ctx-1',
            bundleShareEventId: null,
            bundleId: null,
            requestorEntityId: 'org-entity-1',
            organizationId: 'org-entity-1',
            organizationName: 'Providence',
            purposeOfUse: 'Employment review',
          },
          persistence: {
            mode: 'durable_record',
            target: 'employer_acceptance',
            acceptanceId: 'accept-1',
            reviewItemId: null,
            outboxEventId: 'outbox-1',
            reviewItemCreated: false,
          },
          summary: {
            title: 'Head start accepted',
            description: 'The employer acceptance was persisted and linked to an audit event.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: null,
            priority: null,
          },
          context: {
            role: null,
            facility: null,
            notes: null,
          },
        },
      },
    }]);

    const state = await loadEmployerReviewStatus({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      bundleId: 'bundle-1',
    });

    expect(state).toEqual(expect.objectContaining({
      action: 'accept',
      auditEventId: 'audit-accept-1',
      attribution: expect.objectContaining({
        source: 'organization_context',
        organizationContextId: 'ctx-1',
        organizationId: 'org-entity-1',
      }),
      persistence: expect.objectContaining({
        outboxEventId: 'outbox-1',
      }),
    }));
  });

  it('keeps review continuity when a stored bundle-share attribution is reopened by organization context', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([{
      id: 'audit-accept-2',
      createdAt: new Date('2026-03-23T20:10:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'accept',
          employerId: 'employer-1',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          requestId: 'req-accept-2',
          attribution: {
            source: 'bundle_share',
            organizationContextId: 'ctx-1',
            bundleShareEventId: 'share-1',
            bundleId: 'bundle-1',
            requestorEntityId: 'org-entity-1',
            organizationId: 'org-entity-1',
            organizationName: 'Providence',
            purposeOfUse: 'Employment review',
          },
          persistence: {
            mode: 'durable_record',
            target: 'employer_acceptance',
            acceptanceId: 'accept-1',
            reviewItemId: null,
            outboxEventId: 'outbox-1',
            reviewItemCreated: false,
          },
          summary: {
            title: 'Head start accepted',
            description: 'The employer acceptance was persisted and linked to an audit event.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: null,
            priority: null,
          },
          context: {
            role: null,
            facility: null,
            notes: null,
          },
        },
      },
    }]);

    const state = await loadEmployerReviewStatus({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(state).toEqual(expect.objectContaining({
      action: 'accept',
      auditEventId: 'audit-accept-2',
      attribution: expect.objectContaining({
        source: 'bundle_share',
        organizationContextId: 'ctx-1',
        bundleShareEventId: 'share-1',
        organizationId: 'org-entity-1',
      }),
      persistence: expect.objectContaining({
        acceptanceId: 'accept-1',
        outboxEventId: 'outbox-1',
      }),
    }));
  });
});
