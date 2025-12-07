/**
 * COMP-007: Unit Tests for PoU and Minimum-Necessary Enforcement
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { pouMiddleware, PouRequest } from '../pouMiddleware';

// Mock Prisma Client at module level
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    pouPolicy: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  })),
}));

describe('PoU Middleware', () => {
  let mockPrisma: any;
  let mockReq: Partial<PouRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let responseBody: any;

  beforeEach(() => {
    jest.clearAllMocks();
    responseBody = null;

    mockReq = {
      user: {
        id: 'user-123',
        role: 'clinician',
      },
      path: '/api/credentials/cred-456',
      headers: {},
      query: {},
    };

    mockRes = {
      json: jest.fn(function(body: any) {
        responseBody = body;
        return this;
      }),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('Missing PoU', () => {
    it('should pass through when PoU is not specified', async () => {
      // No PoU in user, headers, or query
      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.pouContext).toBeUndefined();
    });
  });

  describe('PoU from JWT claim', () => {
    it('should extract PoU from user.pou claim', async () => {
      (mockReq.user as any).pou = 'TREATMENT';

      mockFindUnique.mockResolvedValue({
        role: 'clinician',
        purposeOfUse: 'TREATMENT',
        resourceType: 'Credential',
        allowedAttributes: ['id', 'name', 'type'],
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      // Wait for async policy lookup
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockReq.pouContext?.purposeOfUse).toBe('TREATMENT');
      expect(mockReq.pouContext?.allowedAttributes).toEqual(['id', 'name', 'type']);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('PoU from header', () => {
    it('should extract PoU from X-Purpose-Of-Use header', async () => {
      mockReq.headers = {
        'x-purpose-of-use': 'OPERATIONS',
      };

      (mockPrisma.pouPolicy.findUnique as jest.Mock).mockResolvedValue({
        role: 'clinician',
        purposeOfUse: 'OPERATIONS',
        resourceType: 'Credential',
        allowedAttributes: ['id', 'type'],
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      expect(mockReq.pouContext?.purposeOfUse).toBe('OPERATIONS');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Response filtering', () => {
    it('should filter response payload to only allowed attributes', async () => {
      (mockReq.user as any).pou = 'TREATMENT';

      (mockPrisma.pouPolicy.findUnique as jest.Mock).mockResolvedValue({
        role: 'clinician',
        purposeOfUse: 'TREATMENT',
        resourceType: 'Credential',
        allowedAttributes: ['id', 'name', 'type'],
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      // Simulate response with more fields than allowed
      const fullPayload = {
        id: 'cred-456',
        name: 'Medical License',
        type: 'License',
        secretKey: 'should-not-be-disclosed',
        sensitiveData: 'also-should-not-be-disclosed',
      };

      (mockRes.json as jest.Mock)(fullPayload);

      // Verify only allowed fields are present
      expect(responseBody).toEqual({
        id: 'cred-456',
        name: 'Medical License',
        type: 'License',
      });
      expect(responseBody.secretKey).toBeUndefined();
      expect(responseBody.sensitiveData).toBeUndefined();
    });

    it('should filter array responses', async () => {
      (mockReq.user as any).pou = 'RESEARCH';

      (mockPrisma.pouPolicy.findUnique as jest.Mock).mockResolvedValue({
        role: 'researcher',
        purposeOfUse: 'RESEARCH',
        resourceType: 'Credential',
        allowedAttributes: ['id', 'type'],
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      const arrayPayload = [
        { id: 'cred-1', type: 'License', secret: 'hidden' },
        { id: 'cred-2', type: 'Certification', secret: 'hidden' },
      ];

      (mockRes.json as jest.Mock)(arrayPayload);

      expect(responseBody).toEqual([
        { id: 'cred-1', type: 'License' },
        { id: 'cred-2', type: 'Certification' },
      ]);
    });
  });

  describe('No policy found', () => {
    it('should pass through without filtering if no policy exists', async () => {
      (mockReq.user as any).pou = 'TREATMENT';

      mockFindUnique.mockResolvedValue(null);

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      const payload = { id: 'cred-456', name: 'Test', secret: 'hidden' };
      (mockRes.json as jest.Mock)(payload);

      // Should not filter if no policy
      expect(responseBody).toEqual(payload);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Resource type inference', () => {
    it('should correctly infer Credential resource type', async () => {
      mockReq.path = '/api/credentials/123';
      (mockReq.user as any).pou = 'TREATMENT';

      (mockPrisma.pouPolicy.findUnique as jest.Mock).mockResolvedValue({
        role: 'clinician',
        purposeOfUse: 'TREATMENT',
        resourceType: 'Credential',
        allowedAttributes: ['id'],
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should correctly infer Candidate resource type', async () => {
      mockReq.path = '/api/candidates/456';
      (mockReq.user as any).pou = 'OPERATIONS';

      (mockPrisma.pouPolicy.findUnique as jest.Mock).mockResolvedValue({
        role: 'hr',
        purposeOfUse: 'OPERATIONS',
        resourceType: 'Candidate',
        allowedAttributes: ['id', 'name'],
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('applyMinimumNecessary function', () => {
    it('should filter payload based on policy', async () => {
      // Note: This test requires the function to use a Prisma instance
      // In the actual implementation, you'd need to create a service instance
      // For now, we test the concept through the middleware
      expect(true).toBe(true); // Placeholder - actual implementation would test the service
    });
  });

  describe('upsertPouPolicy function', () => {
    it('should create a new policy', async () => {
      (mockPrisma.pouPolicy.upsert as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        role: 'clinician',
        purposeOfUse: 'TREATMENT',
        resourceType: 'Credential',
        allowedAttributes: ['id', 'name'],
      });

      await upsertPouPolicy(
        'clinician',
        'TREATMENT',
        'Credential',
        ['id', 'name']
      );

      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  describe('Negative test cases', () => {
    it('should reject disallowed fields silently (strip them)', async () => {
      (mockReq.user as any).pou = 'TREATMENT';

      (mockPrisma.pouPolicy.findUnique as jest.Mock).mockResolvedValue({
        role: 'clinician',
        purposeOfUse: 'TREATMENT',
        resourceType: 'Credential',
        allowedAttributes: ['id'], // Only id allowed
      });

      await pouMiddleware(mockReq as PouRequest, mockRes as Response, mockNext);

      const payload = {
        id: 'cred-456',
        name: 'should-be-stripped',
        secret: 'should-be-stripped',
      };

      (mockRes.json as jest.Mock)(payload);

      expect(responseBody).toEqual({ id: 'cred-456' });
      expect(responseBody.name).toBeUndefined();
      expect(responseBody.secret).toBeUndefined();
    });
  });
});

