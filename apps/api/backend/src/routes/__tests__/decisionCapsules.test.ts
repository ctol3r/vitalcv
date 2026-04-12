import request from 'supertest';
import express from 'express';
import { registerDecisionCapsuleRoutes } from '../decisionCapsules';
import prisma from '../../graphql/prisma_client';
import { computeClinicianTrustState } from '../../services/trust/trustStateEngine';

jest.mock('../../graphql/prisma_client', () => {
  return {
    __esModule: true,
    default: {
      decisionCapsule: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      application: {
        findMany: jest.fn(),
      },
    }
  };
});

jest.mock('../../services/decision/capsuleEngine', () => ({
  capsuleEngine: {
    getCapsulesByNpi: jest.fn(),
    getCapsuleById: jest.fn(),
  },
}));

jest.mock('../../services/trust/trustStateEngine', () => ({
  computeClinicianTrustState: jest.fn(),
}));

const app = express();
app.use(express.json());
registerDecisionCapsuleRoutes(app);

describe('Decision Capsules API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/decision-capsules', () => {
    it('returns capsules for a valid orgId', async () => {
      const mockCapsules = [{ id: '123e4567-e89b-12d3-a456-426614174000', metadata: {}, decisionTimestamp: new Date() }];
      (prisma.decisionCapsule.findMany as jest.Mock).mockResolvedValue(mockCapsules);

      const res = await request(app)
        .get('/api/decision-capsules?org=123e4567-e89b-12d3-a456-426614174000');
        
      expect(res.status).toBe(200);
      expect(res.body.capsules).toHaveLength(1);
    });

    it('returns capsules for a valid npi', async () => {
      const mockCapsules = [{ id: '123e4567-e89b-12d3-a456-426614174000', metadata: {}, decisionTimestamp: new Date() }];
      (prisma.decisionCapsule.findMany as jest.Mock).mockResolvedValue(mockCapsules);

      const res = await request(app)
        .get('/api/decision-capsules?npi=1234567890');
        
      expect(res.status).toBe(200);
      expect(res.body.capsules).toHaveLength(1);
    });
  });

  describe('GET /api/decision-capsules/:id', () => {
    it('returns a capsule by id', async () => {
      const mockCapsule = { id: '123e4567-e89b-12d3-a456-426614174000', metadata: {} };
      (prisma.decisionCapsule.findUnique as jest.Mock).mockResolvedValue(mockCapsule);

      const res = await request(app)
        .get('/api/decision-capsules/123e4567-e89b-12d3-a456-426614174000');
        
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('GET /api/decision-capsules/:id/current-state', () => {
    it('returns the current trust state vs decision state', async () => {
      const mockCapsule = { 
        id: '123e4567-e89b-12d3-a456-426614174000', 
        subjectNpi: '1234567890',
        status: 'VALID',
        impactedByRevocation: true,
        metadata: {
          trust_state_snapshot: { readiness_score: 90 }
        }
      };
      (prisma.decisionCapsule.findUnique as jest.Mock).mockResolvedValue(mockCapsule);
      (computeClinicianTrustState as jest.Mock).mockResolvedValue({
        readiness_score: 70
      });

      const res = await request(app)
        .get('/api/decision-capsules/123e4567-e89b-12d3-a456-426614174000/current-state');
        
      expect(res.status).toBe(200);
      expect(res.body.impactedByRevocation).toBe(true);
      expect(res.body.scoreDelta).toBe(-20);
      expect(res.body.trustDegraded).toBe(true);
    });
  });
});
