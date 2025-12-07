/**
 * Tests for gaps API endpoint
 * S72-POST-3B-003
 */

import request from 'supertest';
import express from 'express';
import gapsRouter from '../list';
import { PrismaClient, GapTicketStatus, GapTicketSeverity } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mockGapTicket = {
    id: 'test-id-1',
    area: 'identity',
    severity: 'CRITICAL' as GapTicketSeverity,
    description: 'Missing OAuth refresh token handling',
    status: 'OPEN' as GapTicketStatus,
    filePath: 'services/auth/sso.ts',
    lineNumber: 42,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    resolvedAt: null,
  };

  const mockGapTicket2 = {
    id: 'test-id-2',
    area: 'psv',
    severity: 'HIGH' as GapTicketSeverity,
    description: 'Need to add license expiration checks',
    status: 'OPEN' as GapTicketStatus,
    filePath: 'services/psv/license.ts',
    lineNumber: 100,
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02'),
    resolvedAt: null,
  };

  const mockGapTicket3 = {
    id: 'test-id-3',
    area: 'identity',
    severity: 'MEDIUM' as GapTicketSeverity,
    description: 'Should cache privilege matrix',
    status: 'RESOLVED' as GapTicketStatus,
    filePath: 'services/privileging/matrix.ts',
    lineNumber: 50,
    createdAt: new Date('2025-01-03'),
    updatedAt: new Date('2025-01-03'),
    resolvedAt: new Date('2025-01-10'),
  };

  const mockPrismaClient = {
    gapTicket: {
      findMany: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    GapTicketStatus: {
      OPEN: 'OPEN',
      IN_PROGRESS: 'IN_PROGRESS',
      RESOLVED: 'RESOLVED',
    },
    GapTicketSeverity: {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
    },
    mockGapTicket,
    mockGapTicket2,
    mockGapTicket3,
    mockPrismaClient,
  };
});

// Import the mocked values
const { mockGapTicket, mockGapTicket2, mockGapTicket3, mockPrismaClient } = require('@prisma/client');

// Mock the service function
jest.mock('../../../../services/gaps/models/GapTicket', () => ({
  listGapTicketsGroupedByArea: jest.fn(),
}));

import { listGapTicketsGroupedByArea } from '../../../../services/gaps/models/GapTicket';

describe('Gaps API Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api/gaps', gapsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/gaps', () => {
    it('should return gaps grouped by area', async () => {
      const grouped = {
        identity: [mockGapTicket],
        psv: [mockGapTicket2],
        privileging: [],
        jobs: [],
        payer: [],
        ehr: [],
        governance: [],
      };

      (listGapTicketsGroupedByArea as jest.Mock).mockResolvedValue(grouped);

      const response = await request(app).get('/api/gaps');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('identity');
      expect(response.body).toHaveProperty('psv');
      expect(response.body).toHaveProperty('privileging');
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('payer');
      expect(response.body).toHaveProperty('ehr');
      expect(response.body).toHaveProperty('governance');
      expect(response.body.identity).toHaveLength(1);
      expect(response.body.psv).toHaveLength(1);
      expect(response.body.identity[0]).toMatchObject({
        id: mockGapTicket.id,
        area: 'identity',
        severity: 'CRITICAL',
        description: 'Missing OAuth refresh token handling',
        status: 'OPEN',
      });
    });

    it('should filter by status when status query parameter is provided', async () => {
      const grouped = {
        identity: [mockGapTicket],
        psv: [],
        privileging: [],
        jobs: [],
        payer: [],
        ehr: [],
        governance: [],
      };

      (listGapTicketsGroupedByArea as jest.Mock).mockResolvedValue(grouped);

      const response = await request(app).get('/api/gaps?status=OPEN');

      expect(response.status).toBe(200);
      expect(listGapTicketsGroupedByArea).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 'OPEN' }
      );
    });

    it('should return all areas even if empty', async () => {
      const grouped = {
        identity: [],
        psv: [],
        privileging: [],
        jobs: [],
        payer: [],
        ehr: [],
        governance: [],
      };

      (listGapTicketsGroupedByArea as jest.Mock).mockResolvedValue(grouped);

      const response = await request(app).get('/api/gaps');

      expect(response.status).toBe(200);
      expect(response.body.identity).toEqual([]);
      expect(response.body.psv).toEqual([]);
      expect(response.body.privileging).toEqual([]);
      expect(response.body.jobs).toEqual([]);
      expect(response.body.payer).toEqual([]);
      expect(response.body.ehr).toEqual([]);
      expect(response.body.governance).toEqual([]);
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app).get('/api/gaps?status=INVALID');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_status');
      expect(response.body.message).toContain('Invalid status');
    });

    it('should handle case-insensitive status parameter', async () => {
      const grouped = {
        identity: [],
        psv: [],
        privileging: [],
        jobs: [],
        payer: [],
        ehr: [],
        governance: [],
      };

      (listGapTicketsGroupedByArea as jest.Mock).mockResolvedValue(grouped);

      const response = await request(app).get('/api/gaps?status=open');

      expect(response.status).toBe(200);
      expect(listGapTicketsGroupedByArea).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 'OPEN' }
      );
    });

    it('should handle database errors gracefully', async () => {
      (listGapTicketsGroupedByArea as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app).get('/api/gaps');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'internal_error');
      expect(response.body.message).toContain('Database connection failed');
    });

    it('should include filePath and lineNumber when present', async () => {
      const grouped = {
        identity: [mockGapTicket],
        psv: [],
        privileging: [],
        jobs: [],
        payer: [],
        ehr: [],
        governance: [],
      };

      (listGapTicketsGroupedByArea as jest.Mock).mockResolvedValue(grouped);

      const response = await request(app).get('/api/gaps');

      expect(response.status).toBe(200);
      expect(response.body.identity[0]).toHaveProperty('filePath', 'services/auth/sso.ts');
      expect(response.body.identity[0]).toHaveProperty('lineNumber', 42);
    });

    it('should include resolvedAt when status is RESOLVED', async () => {
      const grouped = {
        identity: [mockGapTicket3],
        psv: [],
        privileging: [],
        jobs: [],
        payer: [],
        ehr: [],
        governance: [],
      };

      (listGapTicketsGroupedByArea as jest.Mock).mockResolvedValue(grouped);

      const response = await request(app).get('/api/gaps?status=RESOLVED');

      expect(response.status).toBe(200);
      expect(response.body.identity[0]).toHaveProperty('status', 'RESOLVED');
      expect(response.body.identity[0]).toHaveProperty('resolvedAt');
    });
  });
});

