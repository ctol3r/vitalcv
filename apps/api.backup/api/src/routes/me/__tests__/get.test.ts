/**
 * Tests for GET /api/me endpoint
 */

import request from 'supertest';
import express from 'express';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  userOrgLink: {
    findFirst: jest.fn(),
  },
  orgProfile: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  UserRole: {
    CLINICIAN: 'CLINICIAN',
    ORG_ADMIN: 'ORG_ADMIN',
    INTERNAL_ADMIN: 'INTERNAL_ADMIN',
  },
}));

import meRouter from '../get';

describe('GET /api/me', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api/me', (req, res, next) => {
      (req as any).user = { id: 'user-1' };
      next();
    });
    app.use('/api/me', meRouter);
    jest.clearAllMocks();
  });

  it('returns 401 when session is missing', async () => {
    const noSessionApp = express();
    noSessionApp.use('/api/me', meRouter);

    const response = await request(noSessionApp).get('/api/me');
    expect(response.status).toBe(401);
  });

  it('returns clinician profile when user role is CLINICIAN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'clinician@example.com',
      name: 'Dr Demo',
      role: 'CLINICIAN',
      demoUser: false,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      clinicianProfile: {
        npi: '1234567890',
        specialty: '207Q00000X',
        state: 'CA',
        bio: 'Demo bio',
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
      didLinks: [
        { did: 'did:example:123', createdAt: new Date('2025-01-01T00:00:00Z') },
      ],
    });

    const response = await request(app).get('/api/me');

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('clinician@example.com');
    expect(response.body.clinicianProfile.npi).toBe('1234567890');
    expect(response.body.dids).toHaveLength(1);
  });
});

