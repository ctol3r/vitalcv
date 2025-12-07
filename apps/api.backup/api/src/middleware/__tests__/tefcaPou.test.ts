/**
 * Unit tests for TEFCA Purpose of Use (PoU) enforcement middleware
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { enforceTefcaPou, TefcaRequest } from '../tefcaPou.js';

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    qhinConfig: {
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  })),
}));

describe('tefcaPou middleware', () => {
  let mockReq: Partial<TefcaRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      query: {},
      path: '/tefca/fhir/PractitionerRole',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should enforce Treatment PoU successfully', async () => {
    mockReq.headers = {
      'x-org-id': 'org-123',
      'x-purpose-of-use': 'TREATMENT',
    };

    const { PrismaClient } = await import('@prisma/client');
    const prismaInstance = new PrismaClient();
    (prismaInstance.qhinConfig.findUnique as jest.Mock).mockResolvedValue({
      id: 'qhin-1',
      orgId: 'org-123',
      qhinEndpoint: 'https://qhin.example.org/fhir',
      allowedPurposes: ['TREATMENT', 'OPERATIONS'],
      isActive: true,
    });

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.tefca).toBeDefined();
    expect(mockReq.tefca?.purposeOfUse).toBe('TREATMENT');
  });

  it('should reject request without orgId', async () => {
    mockReq.headers = {
      'x-purpose-of-use': 'TREATMENT',
    };

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Organization ID is required',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request without PoU', async () => {
    mockReq.headers = {
      'x-org-id': 'org-123',
    };

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'BadRequest',
        message: expect.stringContaining('Purpose of Use'),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject invalid PoU value', async () => {
    mockReq.headers = {
      'x-org-id': 'org-123',
      'x-purpose-of-use': 'INVALID_PURPOSE',
    };

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'BadRequest',
        message: expect.stringContaining('Invalid Purpose of Use'),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject PoU not allowed for organization', async () => {
    mockReq.headers = {
      'x-org-id': 'org-123',
      'x-purpose-of-use': 'RESEARCH',
    };

    const { PrismaClient } = await import('@prisma/client');
    const prismaInstance = new PrismaClient();
    (prismaInstance.qhinConfig.findUnique as jest.Mock).mockResolvedValue({
      id: 'qhin-1',
      orgId: 'org-123',
      qhinEndpoint: 'https://qhin.example.org/fhir',
      allowedPurposes: ['TREATMENT', 'OPERATIONS'], // RESEARCH not allowed
      isActive: true,
    });

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('RESEARCH'),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject if QHIN config not found', async () => {
    mockReq.headers = {
      'x-org-id': 'org-999',
      'x-purpose-of-use': 'TREATMENT',
    };

    const { PrismaClient } = await import('@prisma/client');
    const prismaInstance = new PrismaClient();
    (prismaInstance.qhinConfig.findUnique as jest.Mock).mockResolvedValue(null);

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('TEFCA access not configured'),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept PoU from query parameter', async () => {
    mockReq.headers = {
      'x-org-id': 'org-123',
    };
    mockReq.query = {
      purposeOfUse: 'OPERATIONS',
    };

    const { PrismaClient } = await import('@prisma/client');
    const prismaInstance = new PrismaClient();
    (prismaInstance.qhinConfig.findUnique as jest.Mock).mockResolvedValue({
      id: 'qhin-1',
      orgId: 'org-123',
      qhinEndpoint: 'https://qhin.example.org/fhir',
      allowedPurposes: ['TREATMENT', 'OPERATIONS'],
      isActive: true,
    });

    await enforceTefcaPou(mockReq as TefcaRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.tefca?.purposeOfUse).toBe('OPERATIONS');
  });
});

