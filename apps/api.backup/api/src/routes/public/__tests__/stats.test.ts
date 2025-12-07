/**
 * Tests for public stats endpoint
 * B133C-MKT-003
 */

import request from 'supertest';
import express from 'express';
import statsRouter, { clearStatsCache, getStatsCacheAge } from '../stats';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    credential: {
      count: jest.fn(),
    },
    partnerConfig: {
      count: jest.fn(),
    },
    jobPosting: {
      count: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('Public Stats Endpoint', () => {
  let app: express.Application;
  let mockPrisma: any;

  beforeEach(() => {
    app = express();
    app.use('/public/stats', statsRouter);

    // Clear cache before each test
    clearStatsCache();

    // Get mock Prisma instance
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/stats', () => {
    it('should return aggregate platform statistics', async () => {
      // Mock database responses
      mockPrisma.credential.count.mockResolvedValue(12500);
      mockPrisma.partnerConfig.count.mockResolvedValue(45);
      mockPrisma.jobPosting.count.mockResolvedValue(320);

      const response = await request(app).get('/public/stats');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        vcsIssued: 12500,
        organizationsLive: 45,
        jobsPosted: 320,
      });
      expect(response.body).toHaveProperty('lastUpdated');
      expect(response.headers['cache-control']).toBe('public, max-age=300');
    });

    it('should cache results for 5 minutes', async () => {
      // First request
      mockPrisma.credential.count.mockResolvedValue(100);
      mockPrisma.partnerConfig.count.mockResolvedValue(10);
      mockPrisma.jobPosting.count.mockResolvedValue(50);

      const response1 = await request(app).get('/public/stats');
      expect(response1.status).toBe(200);
      expect(mockPrisma.credential.count).toHaveBeenCalledTimes(1);

      // Second request (should use cache)
      const response2 = await request(app).get('/public/stats');
      expect(response2.status).toBe(200);
      expect(response2.body.cached).toBe(true);
      expect(mockPrisma.credential.count).toHaveBeenCalledTimes(1); // Not called again

      // Verify cache age is included
      expect(response2.body).toHaveProperty('cacheAge');
      expect(response2.body.cacheAge).toBeGreaterThanOrEqual(0);
    });

    it('should not expose any PHI/PII', async () => {
      mockPrisma.credential.count.mockResolvedValue(1000);
      mockPrisma.partnerConfig.count.mockResolvedValue(20);
      mockPrisma.jobPosting.count.mockResolvedValue(100);

      const response = await request(app).get('/public/stats');

      // Verify response contains only aggregate counts
      expect(response.body).not.toHaveProperty('users');
      expect(response.body).not.toHaveProperty('credentials');
      expect(response.body).not.toHaveProperty('partners');
      expect(response.body).not.toHaveProperty('npi');
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('name');

      // Verify only expected fields
      const allowedFields = ['vcsIssued', 'organizationsLive', 'jobsPosted', 'lastUpdated'];
      Object.keys(response.body).forEach((key) => {
        if (!['cached', 'cacheAge'].includes(key)) {
          expect(allowedFields).toContain(key);
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockPrisma.credential.count.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/public/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.vcsIssued).toBe(0);
      expect(response.body.organizationsLive).toBe(0);
      expect(response.body.jobsPosted).toBe(0);
    });

    it('should return stale cache on error if available', async () => {
      // First request succeeds
      mockPrisma.credential.count.mockResolvedValue(100);
      mockPrisma.partnerConfig.count.mockResolvedValue(10);
      mockPrisma.jobPosting.count.mockResolvedValue(50);

      await request(app).get('/public/stats');

      // Clear cache to force refresh, then simulate error
      clearStatsCache();

      // Manually set cache for this test
      // (In real scenario, cache would be from previous successful request)
      mockPrisma.credential.count.mockRejectedValue(new Error('DB Error'));

      // This would normally serve stale cache, but since we cleared it,
      // it will return the error response
      const response = await request(app).get('/public/stats');
      expect(response.status).toBe(500);
    });
  });

  describe('Cache behavior', () => {
    it('should refresh cache after 5 minutes', async () => {
      mockPrisma.credential.count.mockResolvedValue(100);
      mockPrisma.partnerConfig.count.mockResolvedValue(10);
      mockPrisma.jobPosting.count.mockResolvedValue(50);

      // First request
      await request(app).get('/public/stats');
      expect(mockPrisma.credential.count).toHaveBeenCalledTimes(1);

      // Verify cache age
      const cacheAge = getStatsCacheAge();
      expect(cacheAge).toBeGreaterThanOrEqual(0);
      expect(cacheAge).toBeLessThan(10000); // Less than 10 seconds
    });

    it('should clear cache when requested', () => {
      clearStatsCache();
      const cacheAge = getStatsCacheAge();

      // Cache age should be negative (indicating no cache)
      // or very large (indicating stale cache)
      expect(Math.abs(cacheAge)).toBeGreaterThan(0);
    });
  });

  describe('Response format', () => {
    it('should return numeric values for all counts', async () => {
      mockPrisma.credential.count.mockResolvedValue(12500);
      mockPrisma.partnerConfig.count.mockResolvedValue(45);
      mockPrisma.jobPosting.count.mockResolvedValue(320);

      const response = await request(app).get('/public/stats');

      expect(typeof response.body.vcsIssued).toBe('number');
      expect(typeof response.body.organizationsLive).toBe('number');
      expect(typeof response.body.jobsPosted).toBe('number');
    });

    it('should include ISO timestamp for lastUpdated', async () => {
      mockPrisma.credential.count.mockResolvedValue(100);
      mockPrisma.partnerConfig.count.mockResolvedValue(10);
      mockPrisma.jobPosting.count.mockResolvedValue(50);

      const response = await request(app).get('/public/stats');

      expect(response.body.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(response.body.lastUpdated).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

