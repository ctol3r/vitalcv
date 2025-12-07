/**
 * Unit tests for S72-D1-B-002: Sanctions PSV stub
 *
 * Tests sanctions verification against mock OIG LEIE
 * Covers sanctioned and non-sanctioned scenarios
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

describe('PSV Sanctions Check', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.pSVSanctionsCheck.deleteMany({
      where: {
        npi: { in: ['1234567890', '6666666666', '7777777777', '9999999999', '5555555555', '4444444444'] },
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.pSVSanctionsCheck.deleteMany({
      where: {
        npi: { in: ['1234567890', '6666666666', '7777777777', '9999999999', '5555555555', '4444444444'] },
      },
    });
  });

  describe('POST /psv/sanctions', () => {
    it('should return sanctioned=false for clean provider', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '1234567890',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        sanctioned: false,
        npi: '1234567890',
      });
      expect(res.jsonData.sourceUrl).toContain('oig.hhs.gov');
      expect(res.jsonData.checkedAt).toBeDefined();
      expect(res.jsonData.checkId).toBeDefined();
    });

    it('should return sanctioned=true for test sanctioned provider', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '6666666666',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        sanctioned: true,
        npi: '6666666666',
      });
      expect(res.jsonData.exclusionDetails).toBeDefined();
      expect(res.jsonData.exclusionDetails.exclusionType).toBeDefined();
    });

    it('should return sanctioned=true for second test sanctioned provider', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '7777777777',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.sanctioned).toBe(true);
      expect(res.jsonData.npi).toBe('7777777777');
    });

    it('should reject missing npi', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({});
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject invalid NPI format', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '12345',
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_npi');
    });

    it('should store check in database', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npi: '9999999999',
      });
      const res = mockResponse();

      await handler(req, res);

      const stored = await prisma.pSVSanctionsCheck.findFirst({
        where: {
          npi: '9999999999',
        },
      });

      expect(stored).toBeDefined();
      expect(stored?.sanctioned).toBe(false);
      expect(stored?.sourceUrl).toContain('oig.hhs.gov');
    });
  });

  describe('GET /psv/sanctions/:checkId', () => {
    it('should retrieve a previously performed check', async () => {
      // First create a check
      const sanctionsCheck = await prisma.pSVSanctionsCheck.create({
        data: {
          npi: '1234567890',
          sanctioned: false,
          sourceUrl: 'https://exclusions.oig.hhs.gov/verification.aspx',
          checkedAt: new Date(),
        },
      });

      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/:checkId')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { checkId: sanctionsCheck.id });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toMatchObject({
        sanctioned: false,
        npi: '1234567890',
        checkId: sanctionsCheck.id,
      });
    });

    it('should return 404 for non-existent check', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/:checkId')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { checkId: 'non-existent-id' });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.error).toBe('not_found');
    });
  });

  describe('POST /psv/sanctions/bulk', () => {
    it('should check multiple NPIs', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/bulk')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npis: ['1234567890', '6666666666', '9999999999'],
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.results).toHaveLength(3);
      expect(res.jsonData.results[0].sanctioned).toBe(false);
      expect(res.jsonData.results[1].sanctioned).toBe(true);
      expect(res.jsonData.results[2].sanctioned).toBe(false);
    });

    it('should reject missing npis array', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/bulk')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({});
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject empty npis array', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/bulk')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npis: [],
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject too many NPIs', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/bulk')?.route
        ?.stack[0]?.handle;

      const npis = Array(101).fill('1234567890');
      const req = mockRequest({ npis });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_request');
    });

    it('should reject invalid NPI in array', async () => {
      const sanctionsRouter = (await import('../sanctions')).default;
      const handler = sanctionsRouter.stack.find((s: any) => s.route?.path === '/bulk')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({
        npis: ['1234567890', 'invalid'],
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('invalid_npi');
    });
  });
});

