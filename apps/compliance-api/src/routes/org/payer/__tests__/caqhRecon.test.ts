/**
 * B137C-REPORT-002: CAQH Reconciliation Report Tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4004';

describe('CAQH vs VC vs NCQA Reconciliation Report', () => {
  beforeAll(async () => {
    await seedCaqhReconData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('should return reconciliation report in JSON format', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon')
      .expect(200);

    expect(response.body).toHaveProperty('orgId', 'test-org-1');
    expect(response.body).toHaveProperty('summary');
    expect(response.body).toHaveProperty('items');
    expect(response.body.summary).toHaveProperty('totalClinicians');
    expect(response.body.summary).toHaveProperty('mismatches');
  });

  it('should return CSV format when requested', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon?format=csv')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Clinician DID,Clinician NPI');
    expect(response.text).toContain('NCQA Requirement');
  });

  it('should filter by mismatch only', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon?mismatchOnly=true')
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
    response.body.items.forEach((item: any) => {
      expect(item.mismatch).toBe(true);
    });
  });

  it('should filter by risk level', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon?riskLevel=HIGH')
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
    response.body.items.forEach((item: any) => {
      expect(item.riskLevel).toBe('HIGH');
    });
  });

  it('should filter by NCQA requirement', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon?ncqaRequirement=CR1')
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
    response.body.items.forEach((item: any) => {
      expect(item.ncqaRequirement).toBe('CR1');
    });
  });

  it('should include CAQH, VC, and PSV sources', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon')
      .expect(200);

    if (response.body.items.length > 0) {
      const item = response.body.items[0];
      expect(item).toHaveProperty('caqh');
      expect(item).toHaveProperty('vc');
      expect(item).toHaveProperty('psv');
      expect(item.caqh).toHaveProperty('source', 'CAQH');
      expect(item.vc).toHaveProperty('source', 'VC');
      expect(item.psv).toHaveProperty('source', 'PSV');
    }
  });

  it('should return 404 for org with no CAQH enrollments', async () => {
    await request(API_BASE)
      .get('/org/nonexistent-org/payer/caqh-recon')
      .expect(404);
  });

  it('should include summary by NCQA requirement', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/caqh-recon')
      .expect(200);

    expect(response.body.summary).toHaveProperty('byNcqaRequirement');
    expect(typeof response.body.summary.byNcqaRequirement).toBe('object');
  });
});

async function seedCaqhReconData() {
  // Create test payer
  await prisma.payer.upsert({
    where: { payerId: 'test-payer-caqh' },
    update: {},
    create: {
      payerId: 'test-payer-caqh',
      name: 'Test Payer',
      planTypes: ['HMO'],
      isActive: true
    }
  });

  const payer = await prisma.payer.findUnique({
    where: { payerId: 'test-payer-caqh' }
  });

  if (!payer) throw new Error('Failed to create test payer');

  // Create enrollment with CAQH ID
  const enrollment = await prisma.payerEnrollment.create({
    data: {
      orgId: 'test-org-1',
      payerId: payer.id,
      clinicianDid: 'did:example:clinician-caqh',
      status: 'APPROVED',
      caqhId: 'caqh-recon-test'
    }
  });

  // Create audit events for CAQH, VC, and PSV
  await prisma.payerEnrollmentEvent.createMany({
    data: [
      {
        enrollmentId: enrollment.id,
        eventType: 'caqh_check',
        source: 'CAQH',
        result: 'PASS',
        metadata: {
          field: 'license',
          value: 'CA-123456',
          lastVerified: new Date().toISOString()
        }
      },
      {
        enrollmentId: enrollment.id,
        eventType: 'vc_check',
        source: 'VC',
        result: 'PASS',
        metadata: {
          field: 'license',
          value: 'CA-123456',
          lastVerified: new Date().toISOString()
        }
      },
      {
        enrollmentId: enrollment.id,
        eventType: 'psv_check',
        source: 'PSV',
        result: 'PASS',
        metadata: {
          field: 'license',
          value: 'CA-654321', // Intentional mismatch
          lastVerified: new Date().toISOString()
        }
      }
    ]
  });
}

async function cleanupTestData() {
  await prisma.payerEnrollmentEvent.deleteMany({
    where: {
      enrollment: {
        orgId: 'test-org-1',
        caqhId: 'caqh-recon-test'
      }
    }
  });

  await prisma.payerEnrollment.deleteMany({
    where: { orgId: 'test-org-1', caqhId: 'caqh-recon-test' }
  });

  await prisma.payer.deleteMany({
    where: { payerId: 'test-payer-caqh' }
  });
}

