import request from 'supertest';
import express from 'express';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  clinicianProfile: {
    findUnique: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  UserRole: {
    CLINICIAN: 'CLINICIAN',
    ORG_ADMIN: 'ORG_ADMIN',
  },
}));

const mockUpsert = jest.fn();
jest.mock('../../../../../../services/users/models/ClinicianProfile', () => ({
  upsertClinicianProfile: (...args: any[]) => mockUpsert(...args),
}));

import updateRouter from '../update';

describe('PATCH /clinician/profile', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/clinician/profile', (req, _res, next) => {
      (req as any).user = { id: 'user-1' };
      next();
    });
    app.use('/api/clinician/profile', updateRouter);

    jest.clearAllMocks();
  });

  it('returns 401 when session missing', async () => {
    const noSessionApp = express();
    noSessionApp.use(express.json());
    noSessionApp.use('/api/clinician/profile', updateRouter);

    const res = await request(noSessionApp)
      .patch('/api/clinician/profile')
      .send({});

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not clinician', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ORG_ADMIN' });

    const res = await request(app)
      .patch('/api/clinician/profile')
      .send({ specialty: '207Q00000X', state: 'CA' });

    expect(res.status).toBe(403);
  });

  it('updates profile and logs audit event', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'CLINICIAN',
    });
    mockPrisma.clinicianProfile.findUnique.mockResolvedValue({
      id: 'cp-1',
      userId: 'user-1',
      npi: '1234567890',
    });
    mockUpsert.mockResolvedValue({
      npi: '1234567890',
      specialty: '207Q00000X',
      state: 'CA',
      bio: null,
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    });

    const res = await request(app)
      .patch('/api/clinician/profile')
      .send({ specialty: '207Q00000X', state: 'CA' });

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
  });
});

