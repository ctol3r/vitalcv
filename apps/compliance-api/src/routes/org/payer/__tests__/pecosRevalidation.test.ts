/**
 * B137C-PECOS-003: PECOS Revalidation Report Tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4004';

describe('PECOS Revalidation Report', () => {
  beforeAll(async () => {
    await seedPecosRevalidationData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('should return PECOS revalidation report in JSON format', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation')
      .expect(200);

    expect(response.body).toHaveProperty('orgId', 'test-org-1');
    expect(response.body).toHaveProperty('summary');
    expect(response.body).toHaveProperty('items');
    expect(response.body.summary).toHaveProperty('totalEnrollments');
    expect(response.body.summary).toHaveProperty('overdue');
    expect(response.body.summary).toHaveProperty('byCycle');
  });

  it('should return CSV format when requested', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation?format=csv')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Enrollment ID,Clinician DID');
    expect(response.text).toContain('CMS Form');
  });

  it('should filter by alert level', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation?alertLevel=CRITICAL')
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
    response.body.items.forEach((item: any) => {
      expect(item.alertLevel).toBe('CRITICAL');
    });
  });

  it('should filter by revalidation cycle', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation?cycle=5year')
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
    response.body.items.forEach((item: any) => {
      expect(item.cycle).toBe('5year');
    });
  });

  it('should filter by due date', async () => {
    const dueBefore = '2026-12-31';
    const response = await request(API_BASE)
      .get(`/org/test-org-1/payer/pecos-revalidation?dueBefore=${dueBefore}`)
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
  });

  it('should include 5-year and 3-year cycles in summary', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation')
      .expect(200);

    expect(response.body.summary.byCycle).toHaveProperty('5year');
    expect(response.body.summary.byCycle).toHaveProperty('3year');
  });

  it('should include CMS form types in items', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation')
      .expect(200);

    if (response.body.items.length > 0) {
      const item = response.body.items[0];
      expect(item).toHaveProperty('form');
      expect(['855I', '855R', '855B']).toContain(item.form);
    }
  });

  it('should sort by most urgent first', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation')
      .expect(200);

    if (response.body.items.length > 1) {
      const firstDays = response.body.items[0].daysUntilDue;
      const secondDays = response.body.items[1].daysUntilDue;
      expect(firstDays).toBeLessThanOrEqual(secondDays);
    }
  });

  it('should include recommended actions', async () => {
    const response = await request(API_BASE)
      .get('/org/test-org-1/payer/pecos-revalidation')
      .expect(200);

    if (response.body.items.length > 0) {
      const item = response.body.items[0];
      expect(item).toHaveProperty('recommendedAction');
      expect(typeof item.recommendedAction).toBe('string');
      expect(item.recommendedAction.length).toBeGreaterThan(0);
    }
  });

  it('should return 404 for org with no PECOS enrollments', async () => {
    await request(API_BASE)
      .get('/org/nonexistent-org/payer/pecos-revalidation')
      .expect(404);
  });
});

async function seedPecosRevalidationData() {
  // Create test payer
  await prisma.payer.upsert({
    where: { payerId: 'cms' },
    update: {},
    create: {
      payerId: 'cms',
      name: 'Centers for Medicare & Medicaid Services',
      planTypes: ['Medicare Part A', 'Medicare Part B'],
      requiresPecos: true,
      isActive: true
    }
  });

  const payer = await prisma.payer.findUnique({
    where: { payerId: 'cms' }
  });

  if (!payer) throw new Error('Failed to create CMS payer');

  // Create enrollments with PECOS IDs
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  await prisma.payerEnrollment.createMany({
    data: [
      {
        orgId: 'test-org-1',
        payerId: payer.id,
        clinicianDid: 'did:example:pecos-clinician-1',
        status: 'APPROVED',
        pecosId: 'I0123456789',
        pecosEnrollmentId: 'PECOS-001',
        revalidationDueAt: thirtyDaysFromNow, // Critical (30 days)
        approvedAt: new Date('2020-01-01'),
        metadata: { enrollmentType: 'MEDICARE_AB' }
      },
      {
        orgId: 'test-org-1',
        payerId: payer.id,
        clinicianDid: 'did:example:pecos-clinician-2',
        status: 'APPROVED',
        pecosId: 'I9876543210',
        pecosEnrollmentId: 'PECOS-002',
        revalidationDueAt: oneYearFromNow, // OK (1 year)
        approvedAt: new Date('2021-01-01'),
        metadata: { enrollmentType: 'MEDICARE_AB' }
      }
    ],
    skipDuplicates: true
  });

  // Create PECOS revalidation records
  await prisma.pecosRevalidation.createMany({
    data: [
      {
        npi: '1234567890',
        cycle: '5year',
        dueDate: thirtyDaysFromNow,
        completed: false,
        slackAlerts: ['D-180', 'D-90']
      },
      {
        npi: '0987654321',
        cycle: '3year',
        dueDate: oneYearFromNow,
        completed: false,
        slackAlerts: []
      }
    ],
    skipDuplicates: true
  });
}

async function cleanupTestData() {
  await prisma.pecosRevalidation.deleteMany({
    where: {
      npi: { in: ['1234567890', '0987654321'] }
    }
  });

  await prisma.payerEnrollment.deleteMany({
    where: { orgId: 'test-org-1', pecosId: { not: null } }
  });

  await prisma.payer.deleteMany({
    where: { payerId: 'cms' }
  });
}

