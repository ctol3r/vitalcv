/**
 * Tests for health check endpoints
 * B133C-HEALTH-005
 */

import request from 'supertest';
import express from 'express';
import healthzRouter, { readyzRouter } from '../healthz';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Health Check Endpoints', () => {
  let app: express.Application;
  let mockPrisma: any;

  beforeEach(() => {
    app = express();
    app.use('/healthz', healthzRouter);
    app.use('/readyz', readyzRouter);

    mockPrisma = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('GET /healthz', () => {
    it('should return OK when all components are healthy', async () => {
      // Mock all components as healthy
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.partnerConfig = {
        count: jest.fn().mockResolvedValue(5),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      });

      const response = await request(app).get('/healthz');

      expect(response.status).toBe(200);
      expect(response.body.overall).toBe('OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('components');
    });

    it('should return FAIL when database is down', async () => {
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      mockPrisma.partnerConfig = {
        count: jest.fn().mockResolvedValue(5),
      };

      (global.fetch as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app).get('/healthz');

      expect(response.status).toBe(503);
      expect(response.body.overall).toBe('FAIL');
      expect(response.body.components.database.status).toBe('FAIL');
    });

    it('should return DEGRADED when optional services are down', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.partnerConfig = {
        count: jest.fn().mockResolvedValue(5),
      };

      // Mock TEFCA/FHIR as down but DB/Queue as up
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('tefca') || url.includes('fhir')) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app).get('/healthz');

      expect(response.status).toBe(200); // Still 200, but DEGRADED
      expect(response.body.overall).toBe('DEGRADED');
    });

    it('should include latency for all components', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.partnerConfig = {
        count: jest.fn().mockResolvedValue(5),
      };

      (global.fetch as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app).get('/healthz');

      expect(response.status).toBe(200);
      expect(response.body.components.database).toHaveProperty('latency');
      expect(response.body.components.queue).toHaveProperty('latency');
      expect(typeof response.body.components.database.latency).toBe('number');
    });
  });

  describe('GET /healthz/liveness', () => {
    it('should always return OK for liveness probe', async () => {
      const response = await request(app).get('/healthz/liveness');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /readyz', () => {
    it('should return OK when DB and Queue are healthy', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app).get('/readyz');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.components).toHaveProperty('database');
      expect(response.body.components).toHaveProperty('queue');
    });

    it('should return NOT_READY when DB is down', async () => {
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB down'));

      const response = await request(app).get('/readyz');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('NOT_READY');
    });

    it('should keep /healthz/readiness for backwards compatibility', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app).get('/healthz/readiness');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    });
  });

  describe('Component-specific health checks', () => {
    it('should detect slow database and mark as DEGRADED', async () => {
      // Simulate slow database
      mockPrisma.$queryRaw = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve([{ '?column?': 1 }]), 1500); // 1.5 seconds
        });
      });
      mockPrisma.partnerConfig = {
        count: jest.fn().mockResolvedValue(5),
      };

      (global.fetch as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app).get('/healthz');

      expect(response.body.components.database.status).toBe('DEGRADED');
      expect(response.body.components.database.latency).toBeGreaterThan(1000);
    });

    it('should handle missing environment variables gracefully', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.partnerConfig = {
        count: jest.fn().mockResolvedValue(5),
      };

      // Don't set chain/TEFCA/FHIR URLs
      delete process.env.CHAIN_RPC_URL;
      delete process.env.TEFCA_ENDPOINT;
      delete process.env.FHIR_ENDPOINT;

      const response = await request(app).get('/healthz');

      expect(response.body.components.chain.status).toBe('DEGRADED');
      expect(response.body.components.tefca.status).toBe('DEGRADED');
      expect(response.body.components.fhir.status).toBe('DEGRADED');
      expect(response.body.overall).toBe('DEGRADED');
    });
  });
});

