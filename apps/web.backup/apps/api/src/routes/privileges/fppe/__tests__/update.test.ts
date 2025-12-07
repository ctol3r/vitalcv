import request from 'supertest';
import express from 'express';

const mockPrisma = {
  fPPECase: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    InputJsonValue: Object,
  },
  OrgMembershipRole: {
    REVIEWER: 'REVIEWER',
    ADMIN: 'ADMIN',
    VIEWER: 'VIEWER',
  },
}));

let mockActiveRole = 'REVIEWER';
jest.mock('../../../../middleware/requireActiveOrg', () => {
  return {
    requireActiveOrg: (req: any, _res: any, next: any) => {
      req.activeOrgId = 'org-1';
      req.activeOrgRole = mockActiveRole;
      next();
    },
  };
});

jest.mock('../../../../../../backend/src/middleware/accessGuards', () => ({
  loadUserSession: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1' };
    next();
  },
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

import fppeUpdateRouter from '../update';

describe('PATCH /api/privileges/fppe/:caseId', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/privileges/fppe', fppeUpdateRouter);
    mockActiveRole = 'REVIEWER';
  });

  it('requires reviewer role', async () => {
    mockActiveRole = 'VIEWER';

    const res = await request(app)
      .patch('/api/privileges/fppe/case-1')
      .send({ notes: 'Updated' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ReviewerRoleRequired');
    expect(mockPrisma.fPPECase.findUnique).not.toHaveBeenCalled();
  });

  it('updates FPPE case and logs audit on completion', async () => {
    mockPrisma.fPPECase.findUnique.mockResolvedValue({
      id: 'case-1',
      orgId: 'org-1',
      clinicianId: 'did:example:123',
      privilegeGrantedId: 'pg-1',
      privilegeCode: 'CARD-CATH-ADULT',
      status: 'IN_REVIEW',
      checklist: {
        version: 1,
        privilegeCode: 'CARD-CATH-ADULT',
        items: [],
      },
    });
    mockPrisma.fPPECase.update.mockResolvedValue({
      id: 'case-1',
      orgId: 'org-1',
      clinicianId: 'did:example:123',
      privilegeGrantedId: 'pg-1',
      privilegeCode: 'CARD-CATH-ADULT',
      status: 'COMPLETED',
      checklist: {
        version: 1,
        privilegeCode: 'CARD-CATH-ADULT',
        items: [],
      },
      completedAt: new Date('2025-01-01T00:00:00Z'),
      startAt: new Date('2024-12-01T00:00:00Z'),
      dueAt: new Date('2025-01-15T00:00:00Z'),
      createdAt: new Date('2024-12-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      evaluatorId: 'rev-1',
      notes: null,
    });

    const res = await request(app)
      .patch('/api/privileges/fppe/case-1')
      .send({
        status: 'COMPLETED',
        evaluatorId: 'rev-1',
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.fPPECase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        evaluatorId: 'rev-1',
      }),
    });
    expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
    expect(res.body.data.status).toBe('COMPLETED');
  });
});

