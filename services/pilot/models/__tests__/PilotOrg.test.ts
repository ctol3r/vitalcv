/**
 * S72-POST-3A-001: ORM tests for PilotOrg model
 */

import { PrismaClient } from '@prisma/client';
import { validatePilotOrg } from '../PilotOrg';

const prisma = new PrismaClient();

describe('PilotOrg Model', () => {
  let pilotOrgId: string;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.pilotUnit.deleteMany({});
    await prisma.pilotOrg.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.pilotUnit.deleteMany({});
    await prisma.pilotOrg.deleteMany({});
  });

  test('should create a PilotOrg with all required fields', async () => {
    const pilotOrg = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Test Healthcare System',
        sponsorName: 'Dr. Test Sponsor',
        sponsorEmail: 'sponsor@testhealthcare.org',
        ehrType: 'Epic',
        notes: 'Test notes',
      },
    });

    expect(pilotOrg).toBeDefined();
    expect(pilotOrg.pilotName).toBe('Test Healthcare System');
    expect(pilotOrg.sponsorName).toBe('Dr. Test Sponsor');
    expect(pilotOrg.sponsorEmail).toBe('sponsor@testhealthcare.org');
    expect(pilotOrg.ehrType).toBe('Epic');
    expect(pilotOrg.notes).toBe('Test notes');
    expect(pilotOrg.id).toBeDefined();
    expect(pilotOrg.createdAt).toBeInstanceOf(Date);
    expect(pilotOrg.updatedAt).toBeInstanceOf(Date);

    pilotOrgId = pilotOrg.id;
  });

  test('should create a PilotOrg with minimal required fields', async () => {
    const pilotOrg = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Minimal Test Org',
        sponsorName: 'Minimal Sponsor',
        sponsorEmail: 'minimal@test.org',
      },
    });

    expect(pilotOrg).toBeDefined();
    expect(pilotOrg.pilotName).toBe('Minimal Test Org');
    expect(pilotOrg.ehrType).toBeNull();
    expect(pilotOrg.notes).toBeNull();
  });

  test('should enforce unique constraint on pilotName', async () => {
    await prisma.pilotOrg.create({
      data: {
        pilotName: 'Unique Test Org',
        sponsorName: 'Sponsor',
        sponsorEmail: 'sponsor@test.org',
      },
    });

    await expect(
      prisma.pilotOrg.create({
        data: {
          pilotName: 'Unique Test Org',
          sponsorName: 'Another Sponsor',
          sponsorEmail: 'another@test.org',
        },
      })
    ).rejects.toThrow();
  });

  test('should validate PilotOrg schema', () => {
    const validData = {
      pilotName: 'Test Org',
      sponsorName: 'Sponsor',
      sponsorEmail: 'sponsor@test.org',
      ehrType: 'Epic',
      notes: 'Test notes',
    };

    const result = validatePilotOrg(validData);
    expect(result).toEqual(validData);
  });

  test('should reject invalid email in schema validation', () => {
    const invalidData = {
      pilotName: 'Test Org',
      sponsorName: 'Sponsor',
      sponsorEmail: 'invalid-email',
    };

    expect(() => validatePilotOrg(invalidData)).toThrow();
  });

  test('should update PilotOrg', async () => {
    const pilotOrg = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Update Test Org',
        sponsorName: 'Original Sponsor',
        sponsorEmail: 'original@test.org',
      },
    });

    const updated = await prisma.pilotOrg.update({
      where: { id: pilotOrg.id },
      data: {
        sponsorName: 'Updated Sponsor',
        ehrType: 'Cerner',
      },
    });

    expect(updated.sponsorName).toBe('Updated Sponsor');
    expect(updated.ehrType).toBe('Cerner');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(pilotOrg.updatedAt.getTime());
  });

  test('should delete PilotOrg and cascade delete PilotUnits', async () => {
    const pilotOrg = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Cascade Test Org',
        sponsorName: 'Sponsor',
        sponsorEmail: 'sponsor@test.org',
      },
    });

    await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrg.id,
        name: 'Test Unit',
        type: 'CLINIC',
      },
    });

    await prisma.pilotOrg.delete({
      where: { id: pilotOrg.id },
    });

    const units = await prisma.pilotUnit.findMany({
      where: { orgId: pilotOrg.id },
    });

    expect(units).toHaveLength(0);
  });
});

