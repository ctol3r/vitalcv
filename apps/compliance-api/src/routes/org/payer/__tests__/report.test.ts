/**
 * B137C-REPORT-001: Payer Enrollment Status Report Tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4004';

describe('Payer Enrollment Status Report', () => {
  beforeAll(async () => {
    // Seed test data
    await seedPayerEnrollmentData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('should return payer enrollment report in JSON format', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/report')
      .expect(200);

    expect(response.body).toHaveProperty('orgId', 'test-org-1');
    expect(response.body).toHaveProperty('summary');
    expect(response.body).toHaveProperty('byPayer');
    expect(response.body.summary).toHaveProperty('totalEnrollments');
    expect(response.body.summary).toHaveProperty('byStatus');
  });

  it('should return CSV format when requested', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/report?format=csv')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Payer ID,Payer Name');
  });

  it('should filter by date range', async () => {
    const from = '2025-01-01';
    const to = '2025-12-31';

    const response = await request(API_BASE)
      .get(`/org/test-org-1/payer/report?from=${from}&to=${to}`)
      .expect(200);

    expect(response.body).toHaveProperty('dateRange');
    expect(response.body.dateRange).toHaveProperty('from');
    expect(response.body.dateRange).toHaveProperty('to');
  });

  it('should filter by status', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/report?status=APPROVED')
      .expect(200);

    expect(response.body).toHaveProperty('byPayer');
    expect(response.body.byPayer.length).toBeGreaterThan(0);
  });

  it('should filter by payer', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/report?payerId=aetna')
      .expect(200);

    expect(response.body).toHaveProperty('byPayer');
    expect(response.body.byPayer.length).toBe(1);
    expect(response.body.byPayer[0].payerId).toBe('aetna');
  });

  it('should return 404 for org with no enrollments', async () => {
    await request(API_BASE)
      .get('/org/nonexistent-org/payer/report')
      .expect(404);
  });

  it('should include all enrollment statuses in summary', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/report')
      .expect(200);

    expect(response.body.summary.byStatus).toHaveProperty('DRAFT');
    expect(response.body.summary.byStatus).toHaveProperty('SUBMITTED');
    expect(response.body.summary.byStatus).toHaveProperty('APPROVED');
    expect(response.body.summary.byStatus).toHaveProperty('DENIED');
    expect(response.body.summary.byStatus).toHaveProperty('TERMINATED');
  });
});

async function seedPayerEnrollmentData() {
  // Create test payers
  await prisma.payer.createMany({
    data: [
      {
        payerId: 'aetna',
        name: 'Aetna',
        planTypes: ['HMO', 'PPO'],
        isActive: true
      },
      {
        payerId: 'uhc',
        name: 'UnitedHealthcare',
        planTypes: ['HMO', 'PPO', 'Medicare Advantage'],
        isActive: true
      }
    ],
    skipDuplicates: true
  });

  // Create test enrollments
  const payers = await prisma.payer.findMany({
    where: { payerId: { in: ['aetna', 'uhc'] } }
  });

  for (const payer of payers) {
    await prisma.payerEnrollment.createMany({
      data: [
        {
          orgId: 'test-org-1',
          payerId: payer.id,
          clinicianDid: 'did:example:clinician1',
          status: 'APPROVED',
          caqhId: 'caqh-123456'
        },
        {
          orgId: 'test-org-1',
          payerId: payer.id,
          clinicianDid: 'did:example:clinician2',
          status: 'SUBMITTED',
          caqhId: 'caqh-789012'
        },
        {
          orgId: 'test-org-1',
          payerId: payer.id,
          clinicianDid: 'did:example:clinician3',
          status: 'DRAFT'
        }
      ],
      skipDuplicates: true
    });
  }
}

async function cleanupTestData() {
  await prisma.payerEnrollment.deleteMany({
    where: { orgId: 'test-org-1' }
  });
  await prisma.payer.deleteMany({
    where: { payerId: { in: ['aetna', 'uhc'] } }
  });
}

