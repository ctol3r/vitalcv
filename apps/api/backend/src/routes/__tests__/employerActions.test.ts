import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvEntity: {
      findUnique: jest.fn(),
    },
    employerAcceptance: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../services/seal/sealEventCapture', () => ({
  captureAdvisoryEvent: jest.fn(),
  captureEmployerDecision: jest.fn(),
}));

jest.mock('../../services/entity/passportService', () => ({
  buildPassport: jest.fn(),
}));

jest.mock('../../services/entity/employerPacket', () => ({
  buildEmployerEvidencePacket: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import {
  captureAdvisoryEvent,
  captureEmployerDecision,
} from '../../services/seal/sealEventCapture';
import { registerEmployerActionRoutes } from '../employerActions';

const prismaMock = prisma as unknown as {
  vcvEntity: {
    findUnique: jest.Mock;
  };
  employerAcceptance: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

const captureAdvisoryEventMock =
  captureAdvisoryEvent as jest.MockedFunction<typeof captureAdvisoryEvent>;
const captureEmployerDecisionMock =
  captureEmployerDecision as jest.MockedFunction<typeof captureEmployerDecision>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerEmployerActionRoutes(app);
  app.use((err: { status?: number; statusCode?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? err.statusCode ?? 500).json({ error: err.message ?? 'error' });
  });
  return app;
}

function wireTransactionClient(options?: { reviewItemId?: string | null }) {
  const tx = {
    employerAcceptance: {
      create: prismaMock.employerAcceptance.create,
    },
    auditEvent: {
      create: prismaMock.auditEvent.create,
    },
    hITLReviewItem: options && 'reviewItemId' in options
      ? {
          create: jest.fn().mockResolvedValue(
            options.reviewItemId ? { id: options.reviewItemId } : null,
          ),
        }
      : undefined,
  };

  prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));

  return tx;
}

describe('employer action routes', () => {
  beforeEach(() => {
    prismaMock.vcvEntity.findUnique.mockReset();
    prismaMock.employerAcceptance.findFirst.mockReset();
    prismaMock.employerAcceptance.create.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.auditEvent.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    captureAdvisoryEventMock.mockReset();
    captureEmployerDecisionMock.mockReset();

    prismaMock.vcvEntity.findUnique.mockResolvedValue({
      id: 'entity-1',
      npi: '1234567890',
    });
    prismaMock.employerAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.employerAcceptance.create.mockResolvedValue({
      id: 'accept-1',
      acceptedAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.auditEvent.create.mockResolvedValue({
      id: 'audit-1',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
    });

    wireTransactionClient();
  });

  it('persists accept actions with a durable acceptance record and explicit audit summary', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({ role: 'Recruiter', facility: 'Providence', notes: 'Head start only' })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'accept',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      auditEventId: 'audit-1',
      persistence: expect.objectContaining({
        mode: 'durable_record',
        target: 'employer_acceptance',
        acceptanceId: 'accept-1',
      }),
      summary: {
        title: 'Head start accepted',
        description: 'The employer acceptance was persisted and linked to an audit event.',
      },
    }));

    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        referenceId: 'accept-1',
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            action: 'accept',
            employerId: 'employer-1',
            entityId: 'entity-1',
          }),
        }),
      }),
    }));
    expect(captureEmployerDecisionMock).toHaveBeenCalledWith(expect.objectContaining({
      auditEventId: 'audit-1',
      decision: 'PROCEED',
    }));
  });

  it('records refresh requests as audit-only and normalizes the requested refresh payload', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/request-refresh')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        staleSources: ['CMS PECOS', 'CMS PECOS', '  OIG LEIE  ', '', 12],
        missingDomains: ['LICENSURE', 'LICENSURE', 'BOARD_CERTIFICATION', null],
        message: 'Need fresher source data.',
      })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'refresh',
      persistence: expect.objectContaining({
        mode: 'audit_only',
        target: 'audit_event',
        reviewItemCreated: false,
      }),
      details: {
        staleSources: ['CMS PECOS', 'OIG LEIE'],
        missingDomains: ['LICENSURE', 'BOARD_CERTIFICATION'],
        reason: 'Need fresher source data.',
        priority: null,
      },
      summary: {
        title: 'Refresh request recorded',
        description: 'The refresh request was persisted in the audit trail. No clinician notification is persisted here yet.',
      },
    }));

    expect(captureAdvisoryEventMock).toHaveBeenCalledWith(expect.objectContaining({
      blockersAtEvent: ['LICENSURE', 'BOARD_CERTIFICATION'],
      sourceCoverageAtEvent: { staleSources: ['CMS PECOS', 'OIG LEIE'] },
    }));
  });

  it('routes to review with an explicit durable queue result when a review item is created', async () => {
    wireTransactionClient({ reviewItemId: 'review-item-1' });

    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/route-to-review')
      .set('x-clerk-user-id', 'employer-1')
      .send({ reason: 'Manual check required', priority: 'high' })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'review',
      persistence: {
        mode: 'durable_record',
        target: 'review_queue_item',
        acceptanceId: null,
        reviewItemId: 'review-item-1',
        reviewItemCreated: true,
      },
      details: {
        staleSources: [],
        missingDomains: [],
        reason: 'Manual check required',
        priority: 'HIGH',
      },
      summary: {
        title: 'Routed to review',
        description: 'The routing decision and manual review queue item were both persisted.',
      },
    }));
  });

  it('fails closed on duplicate accept attempts without creating new persistence side effects', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce({ id: 'accept-existing' });

    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({})
      .expect(409);

    expect(response.body).toEqual({
      error: 'already_accepted',
      error_description: 'An active acceptance already exists for this employer/NPI pair.',
      acceptanceId: 'accept-existing',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
    expect(captureEmployerDecisionMock).not.toHaveBeenCalled();
  });

  it('returns the latest persisted audit-only state on status reads when no durable queue item exists', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce(null);
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({
      id: 'audit-review-1',
      createdAt: new Date('2026-03-23T19:30:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'review',
          employerId: 'employer-1',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          requestId: 'req-1',
          persistence: {
            mode: 'audit_only',
            target: 'audit_event',
            acceptanceId: null,
            reviewItemId: null,
            reviewItemCreated: false,
          },
          summary: {
            title: 'Review routing recorded',
            description: 'The routing decision was persisted in the audit trail, but no durable manual review queue item was created in this environment.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: 'Manual review still needed',
            priority: 'HIGH',
          },
          context: {
            role: null,
            facility: null,
            notes: null,
          },
        },
      },
    });

    const response = await request(buildApp())
      .get('/api/employer-review/entity-1/status')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      state: {
        action: 'review',
        entityId: 'entity-1',
        clinicianNpi: '1234567890',
        auditEventId: 'audit-review-1',
        timestamp: '2026-03-23T19:30:00.000Z',
        persistence: {
          mode: 'audit_only',
          target: 'audit_event',
          acceptanceId: null,
          reviewItemId: null,
          reviewItemCreated: false,
        },
        summary: {
          title: 'Review routing recorded',
          description: 'The routing decision was persisted in the audit trail, but no durable manual review queue item was created in this environment.',
        },
        details: {
          staleSources: [],
          missingDomains: [],
          reason: 'Manual review still needed',
          priority: 'HIGH',
        },
      },
    });
  });
});
