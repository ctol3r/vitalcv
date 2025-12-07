/**
 * B116C-FEEDS-034: Tests for Directory badge API: 'Verified via FHIR Pipeline' evidence flag + URL
 *
 * Tests verify that:
 * - Flag+URL returned when evidence exists
 * - Frontend can consume the response
 * - Tests pass
 */

import { Request, Response } from 'express';
import { fhirBadgeRouter } from '../routes/fhir-badge';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      agentRun: {
        findMany: jest.fn(),
      },
      evidence: {
        findFirst: jest.fn(),
      },
    })),
  };
});

describe('FHIR Badge API', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockReq = {
      params: { npi: '1234567890' },
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('GET /compliance/fhir-badge/:npi', () => {
    it('should return evidenceFlag and evidenceUrl when FHIR run exists', async () => {
      // Mock successful FHIR run
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-123',
          npi: '1234567890',
          agentName: 'FHIR_PIPELINE',
          status: 'ok',
          finishedAt: new Date('2025-01-01'),
        },
      ]);

      (mockPrisma.evidence.findFirst as jest.Mock).mockResolvedValue(null);

      // Execute route handler
      const handler = fhirBadgeRouter.stack.find(
        (layer) => layer.route?.path === '/compliance/fhir-badge/:npi'
      )?.route?.stack[0]?.handle;

      if (handler) {
        await handler(mockReq as Request, mockRes as Response);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            verified: true,
            evidenceFlag: true,
            runId: 'run-123',
            runUrl: expect.stringContaining('/api/agents/runs/run-123'),
          })
        );
      }
    });

    it('should return evidenceFlag and evidenceUrl when evidence exists', async () => {
      // Mock evidence linked to NPI
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([]);

      (mockPrisma.evidence.findFirst as jest.Mock).mockResolvedValue({
        id: 'evidence-123',
        doi: '10.1001/jama.2024.12345',
        title: 'Test Evidence',
        createdAt: new Date('2025-01-01'),
      });

      const handler = fhirBadgeRouter.stack.find(
        (layer) => layer.route?.path === '/compliance/fhir-badge/:npi'
      )?.route?.stack[0]?.handle;

      if (handler) {
        await handler(mockReq as Request, mockRes as Response);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            verified: true,
            evidenceFlag: true,
            evidenceUrl: '/api/evidence/registry/evidence-123',
            evidence: {
              id: 'evidence-123',
              doi: '10.1001/jama.2024.12345',
              title: 'Test Evidence',
            },
          })
        );
      }
    });

    it('should return verified: false when no FHIR run or evidence exists', async () => {
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.evidence.findFirst as jest.Mock).mockResolvedValue(null);

      const handler = fhirBadgeRouter.stack.find(
        (layer) => layer.route?.path === '/compliance/fhir-badge/:npi'
      )?.route?.stack[0]?.handle;

      if (handler) {
        await handler(mockReq as Request, mockRes as Response);

        expect(mockRes.json).toHaveBeenCalledWith({
          verified: false,
        });
      }
    });

    it('should return 400 for invalid NPI format', async () => {
      mockReq.params = { npi: 'invalid' };

      const handler = fhirBadgeRouter.stack.find(
        (layer) => layer.route?.path === '/compliance/fhir-badge/:npi'
      )?.route?.stack[0]?.handle;

      if (handler) {
        await handler(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'invalid_npi',
          })
        );
      }
    });
  });
});

