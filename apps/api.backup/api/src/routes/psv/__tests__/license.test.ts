/**
 * Unit tests for S72-D1-B-001: License PSV stub
 *
 * Tests license verification against mock state board API
 * Covers ACTIVE and INACTIVE status scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock Express request/response
const mockRequest = (body: any = {}, params: any = {}) => ({
  body,
  params,
});

const mockResponse = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

describe('PSV License Check', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.pSVLicenseCheck.deleteMany({
      where: {
        npi: { in: ['1234567890', '0987654321', '1111111111', '2222222222', '9999999999'] },
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.pSVLicenseCheck.deleteMany({
      where: {
        npi: { in: ['1234567890', '0987654321', '1111111111', '2222222222', '9999999999'] },
      },
    });
  });

  describe('POST /psv/license', () => {
    it('should return ACTIVE status for valid license', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        status: 'ACTIVE',
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });
      expect(res.jsonData.sourceUrl).toContain('stateboard.ca.gov');
      expect(res.jsonData.checkedAt).toBeDefined();
      expect(res.jsonData.checkId).toBeDefined();
    });

    it('should return INACTIVE status for inactive license', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '0987654321',
        state: 'NY',
        licenseNumber: '789012',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        status: 'INACTIVE',
        npi: '0987654321',
        state: 'NY',
        licenseNumber: '789012',
      });
      expect(res.jsonData.sourceUrl).toContain('stateboard.ny.gov');
    });

    it('should return EXPIRED status for expired license', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1111111111',
        state: 'TX',
        licenseNumber: '555555',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        status: 'EXPIRED',
        npi: '1111111111',
        state: 'TX',
        licenseNumber: '555555',
      });
    });

    it('should return SUSPENDED status for suspended license', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '2222222222',
        state: 'FL',
        licenseNumber: '666666',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        status: 'SUSPENDED',
        npi: '2222222222',
        state: 'FL',
        licenseNumber: '666666',
      });
    });

    it('should default to ACTIVE for unknown licenses', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '9999999999',
        state: 'WA',
        licenseNumber: '999999',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.status).toBe('ACTIVE');
    });

    it('should reject missing npi', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        state: 'CA',
        licenseNumber: '123456',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject missing state', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1234567890',
        licenseNumber: '123456',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject missing licenseNumber', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1234567890',
        state: 'CA',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject invalid state code', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1234567890',
        state: 'CALIFORNIA',
        licenseNumber: '123456',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_state');
    });

    it('should reject invalid NPI format', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '12345',
        state: 'CA',
        licenseNumber: '123456',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_npi');
    });

    it('should store check in database', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });
      const res = mockResponse();

      await handler(req, res);

      const stored = await prisma.pSVLicenseCheck.findFirst({
        where: {
          npi: '1234567890',
          state: 'CA',
          licenseNumber: '123456',
        },
      });

      expect(stored).toBeDefined();
      expect(stored?.status).toBe('ACTIVE');
      expect(stored?.sourceUrl).toContain('stateboard.ca.gov');
    });
  });

  describe('GET /psv/license/:checkId', () => {
    it('should retrieve a previously performed check', async () => {
      // First create a check
      const licenseCheck = await prisma.pSVLicenseCheck.create({
        data: {
          npi: '1234567890',
          state: 'CA',
          licenseNumber: '123456',
          status: 'ACTIVE',
          sourceUrl: 'https://stateboard.ca.gov/verify/123456',
          checkedAt: new Date(),
        },
      });

      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/:checkId')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { checkId: licenseCheck.id });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        status: 'ACTIVE',
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
        checkId: licenseCheck.id,
      });
    });

    it('should return 404 for non-existent check', async () => {
      const licenseRouter = (await import('../license')).default;
      const handler = licenseRouter.stack.find((s: any) => s.route?.path === '/:checkId')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { checkId: 'non-existent-id' });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.error).toBe('not_found');
    });
  });
});

