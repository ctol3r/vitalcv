/**
 * B128C-FEEDS-034: Enhanced FHIR Badge API Tests
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { fhirBadgeRouter } from '../fhir-badge';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(fhirBadgeRouter);

describe('B128C-FEEDS-034: FHIR Badge API', () => {
  const testNpi = '1234567890';

  beforeEach(async () => {
    // Clean up test data
    await prisma.agentRun.deleteMany({
      where: { npi: testNpi },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Flag + URL returned', () => {
    it('should return evidence flag and URL when verified', async () => {
      // Create a successful FHIR run
      await prisma.agentRun.create({
        data: {
          id: `test-run-${Date.now()}`,
          npi: testNpi,
          agentName: 'FHIR Pipeline Agent',
          status: 'ok',
          startedAt: new Date(),
          finishedAt: new Date(),
          results: {},
        },
      });

      const response = await request(app)
        .get(`/compliance/fhir-badge/${testNpi}`);

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(response.body.evidenceFlag).toBe(true);
      expect(response.body.evidenceUrl).toBeDefined();
      expect(response.body.runUrl).toBeDefined();
    });

    it('should return false when not verified', async () => {
      const response = await request(app)
        .get('/compliance/fhir-badge/9999999999');

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.evidenceFlag).toBeUndefined();
    });
  });

  describe('Frontend consumption', () => {
    it('should return complete badge object for FE rendering', async () => {
      await prisma.agentRun.create({
        data: {
          id: `test-run-${Date.now()}`,
          npi: testNpi,
          agentName: 'FHIR Pipeline Agent',
          status: 'ok',
          startedAt: new Date(),
          finishedAt: new Date(),
          results: {},
        },
      });

      const response = await request(app)
        .get(`/compliance/fhir-badge/${testNpi}`);

      expect(response.body.badge).toBeDefined();
      expect(response.body.badge.type).toBe('fhir_pipeline_verified');
      expect(response.body.badge.label).toBe('Verified via FHIR Pipeline');
      expect(response.body.badge.url).toBeDefined();
      expect(response.body.badge.npi).toBe(testNpi);
    });
  });

  describe('Tests pass', () => {
    it('should validate NPI format', async () => {
      const response = await request(app)
        .get('/compliance/fhir-badge/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_npi');
    });

    it('should handle database errors gracefully', async () => {
      // Disconnect prisma to simulate error
      await prisma.$disconnect();

      const response = await request(app)
        .get(`/compliance/fhir-badge/${testNpi}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('lookup_failed');

      // Reconnect for cleanup
      await prisma.$connect();
    });

    it('should return most recent verification', async () => {
      // Create multiple runs
      const oldRun = await prisma.agentRun.create({
        data: {
          id: `old-run-${Date.now()}`,
          npi: testNpi,
          agentName: 'FHIR Pipeline Agent',
          status: 'ok',
          startedAt: new Date('2024-01-01'),
          finishedAt: new Date('2024-01-01'),
          results: {},
        },
      });

      const newRun = await prisma.agentRun.create({
        data: {
          id: `new-run-${Date.now()}`,
          npi: testNpi,
          agentName: 'FHIR Pipeline Agent',
          status: 'ok',
          startedAt: new Date(),
          finishedAt: new Date(),
          results: {},
        },
      });

      const response = await request(app)
        .get(`/compliance/fhir-badge/${testNpi}`);

      expect(response.body.runId).toBe(newRun.id);
      expect(response.body.runId).not.toBe(oldRun.id);
    });
  });

  describe('Evidence linking', () => {
    it('should link to evidence registry when available', async () => {
      const evidence = await prisma.evidence.create({
        data: {
          doi: '10.1001/test.fhir.verification',
          title: 'FHIR Pipeline Verification Evidence',
          abstract: 'Evidence of successful FHIR pipeline verification',
          authors: ['System'],
          journal: 'VitalCV Evidence Registry',
          publishedAt: new Date(),
          hash: 'abc123',
          metadata: {
            fhirVerifiedNpi: testNpi,
            verificationType: 'fhir_pipeline',
          },
        },
      });

      const response = await request(app)
        .get(`/compliance/fhir-badge/${testNpi}`);

      expect(response.body.verified).toBe(true);
      expect(response.body.evidence).toBeDefined();
      expect(response.body.evidence.id).toBe(evidence.id);
      expect(response.body.evidence.hash).toBeDefined();
      expect(response.body.evidenceUrl).toContain(evidence.id);

      // Cleanup
      await prisma.evidence.delete({ where: { id: evidence.id } });
    });
  });
});

