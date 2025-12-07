import express from 'express';
import request from 'supertest';
import router from '../enroll/getRequirements';

const mockPrisma = {
  payerEnrollment: { findUnique: jest.fn() },
  didUserLink: { findUnique: jest.fn() },
  clinicianProfile: { findUnique: jest.fn() },
  caqhProfile: { findFirst: jest.fn() },
  payerRequirement: { findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../../../../../../backend/src/middleware/accessGuards', () => ({
  loadUserSession: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/requireActiveOrg', () => ({
  requireActiveOrg: (_req: any, _res: any, next: any) => {
    ( _req as any ).activeOrgId = 'demo-org';
    next();
  },
  ActiveOrgRequest: class {},
}));

describe('GET /api/payer/enroll/:id/requirements', () => {
  it('returns demo requirements payload for demo id', async () => {
    const app = express();
    app.use('/api/payer/enroll', router);

    const response = await request(app).get('/api/payer/enroll/demo/requirements');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.requirements.length).toBeGreaterThan(0);
  });
});

