/**
 * Tests for risk gate middleware
 */

import { Request, Response, NextFunction } from 'express';
import { riskGate } from '../riskGate';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock the risk engine
jest.mock('../../../services/risk/engine', () => ({
  computeRiskScore: jest.fn(),
  storeRiskScore: jest.fn(),
}));

// Mock audit logging
jest.mock('../../../services/audit/riskEvents', () => ({
  recordRiskEvent: jest.fn(),
}));

import { computeRiskScore } from '../../../services/risk/engine';
import { recordRiskEvent } from '../../../services/audit/riskEvents';

describe('riskGate middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {
        'x-device-id': 'test-device-1',
        'user-agent': 'Mozilla/5.0',
      },
      ip: '192.168.1.1',
      body: {},
      cookies: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should allow request with low risk score', async () => {
    (computeRiskScore as jest.Mock).mockResolvedValue({
      score: 20,
      reasonTags: [],
    });

    const middleware = riskGate('login');
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block request with high risk score', async () => {
    (computeRiskScore as jest.Mock).mockResolvedValue({
      score: 80,
      reasonTags: ['HIGH_VELOCITY', 'SUSPICIOUS_UA'],
    });

    const middleware = riskGate('login');
    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'HIGH_RISK',
      })
    );
  });

  it('should log warning for medium risk score', async () => {
    (computeRiskScore as jest.Mock).mockResolvedValue({
      score: 50,
      reasonTags: ['HIGH_VELOCITY'],
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const middleware = riskGate('login');
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RISK_GATE] High risk score (warning)'),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('should handle missing deviceId gracefully', async () => {
    delete req.headers!['x-device-id'];

    (computeRiskScore as jest.Mock).mockResolvedValue({
      score: 0,
      reasonTags: [],
    });

    const middleware = riskGate('login');
    await middleware(req as Request, res as Response, next);

    // Should allow but log warning
    expect(next).toHaveBeenCalled();
  });

  it('should record risk event', async () => {
    (computeRiskScore as jest.Mock).mockResolvedValue({
      score: 30,
      reasonTags: [],
    });

    const middleware = riskGate('login');
    await middleware(req as Request, res as Response, next);

    expect(recordRiskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'test-device-1',
        score: 30,
        route: 'login',
      })
    );
  });
});

