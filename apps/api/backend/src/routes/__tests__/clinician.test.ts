import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    personProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../../services/workspace/workspaceService', () => ({
  ensureWorkspaceUser: jest.fn(),
  bootstrapFromNpi: jest.fn(),
}));

jest.mock('../../services/trust/trustStateEngine', () => ({
  refreshTrustState: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { refreshTrustState } from '../../services/trust/trustStateEngine';
import {
  bootstrapFromNpi,
  ensureWorkspaceUser,
} from '../../services/workspace/workspaceService';
import { registerClinicianRoutes } from '../clinician';

const prismaMock = prisma as unknown as {
  personProfile: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
};

const workspaceMock = {
  ensureWorkspaceUser: ensureWorkspaceUser as jest.Mock,
  bootstrapFromNpi: bootstrapFromNpi as jest.Mock,
};

const trustStateMock = {
  refreshTrustState: refreshTrustState as jest.Mock,
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerClinicianRoutes(app);
  app.use((
    err: { status?: number; message?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Unknown error' });
  });
  return app;
}

describe('clinician activation routes', () => {
  beforeEach(() => {
    prismaMock.personProfile.findUnique.mockReset();
    prismaMock.personProfile.upsert.mockReset();
    workspaceMock.ensureWorkspaceUser.mockReset();
    workspaceMock.bootstrapFromNpi.mockReset();
    trustStateMock.refreshTrustState.mockReset();
  });

  it('activates a clinician, persists the NPI, and returns readiness state', async () => {
    workspaceMock.ensureWorkspaceUser.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    workspaceMock.bootstrapFromNpi.mockResolvedValue({
      npi: '1234567890',
      npiType: 'TYPE_1',
      inferredPersona: 'CLINICIAN',
      firstName: 'Ada',
      lastName: 'Lovelace',
      specialty: 'Cardiology',
      state: 'CA',
      alreadyRegistered: false,
    });
    trustStateMock.refreshTrustState.mockResolvedValue({
      readiness_score: 91,
      readiness_level: 'L3',
      readiness_status: 'Ready to credential — all evidence verified',
    });

    const response = await request(createApp())
      .post('/api/clinician/activate')
      .set('x-clerk-user-id', 'clerk-user-1')
      .set('x-clerk-user-email', 'ada@example.com')
      .send({ npi: '1234567890' })
      .expect(200);

    expect(prismaMock.personProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
      create: expect.objectContaining({
        userId: 'user-1',
        npi: '1234567890',
        firstName: 'Ada',
      }),
      update: expect.objectContaining({
        npi: '1234567890',
        specialty: 'Cardiology',
      }),
    }));
    expect(trustStateMock.refreshTrustState).toHaveBeenCalledWith('1234567890');
    expect(response.body).toEqual({
      readinessScore: 91,
      readinessLevel: 'L3',
      readinessStatus: 'Ready to credential — all evidence verified',
    });
  });

  it('rejects organization NPIs for clinician activation', async () => {
    workspaceMock.ensureWorkspaceUser.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    workspaceMock.bootstrapFromNpi.mockResolvedValue({
      npi: '1234567890',
      npiType: 'TYPE_2',
      inferredPersona: 'VERIFIER',
      alreadyRegistered: false,
    });

    const response = await request(createApp())
      .post('/api/clinician/activate')
      .set('x-clerk-user-id', 'clerk-user-1')
      .send({ npi: '1234567890' })
      .expect(400);

    expect(response.body.error).toBe('Only individual Type 1 NPIs can activate a clinician profile.');
    expect(prismaMock.personProfile.upsert).not.toHaveBeenCalled();
    expect(trustStateMock.refreshTrustState).not.toHaveBeenCalled();
  });
});
