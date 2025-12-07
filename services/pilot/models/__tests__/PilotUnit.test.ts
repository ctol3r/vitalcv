/**
 * S72-POST-3A-003: ORM tests for PilotUnit model
 */

import { PrismaClient } from '@prisma/client';
import { validatePilotUnit, PilotUnitType } from '../PilotUnit';

const prisma = new PrismaClient();

describe('PilotUnit Model', () => {
  let pilotOrgId: string;

  beforeAll(async () => {
    // Create a test pilot org
    const pilotOrg = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Test Org for Units',
        sponsorName: 'Sponsor',
        sponsorEmail: 'sponsor@test.org',
      },
    });
    pilotOrgId = pilotOrg.id;
  });

  afterAll(async () => {
    await prisma.pilotUnit.deleteMany({});
    await prisma.pilotOrg.deleteMany({});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.pilotUnit.deleteMany({});
  });

  test('should create a PilotUnit with all fields', async () => {
    const pilotUnit = await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Emergency Department',
        type: PilotUnitType.DEPT,
        ehrCostCenterCode: 'ED-001',
      },
    });

    expect(pilotUnit).toBeDefined();
    expect(pilotUnit.name).toBe('Emergency Department');
    expect(pilotUnit.type).toBe(PilotUnitType.DEPT);
    expect(pilotUnit.ehrCostCenterCode).toBe('ED-001');
    expect(pilotUnit.orgId).toBe(pilotOrgId);
    expect(pilotUnit.id).toBeDefined();
    expect(pilotUnit.createdAt).toBeInstanceOf(Date);
    expect(pilotUnit.updatedAt).toBeInstanceOf(Date);
  });

  test('should create a PilotUnit without optional ehrCostCenterCode', async () => {
    const pilotUnit = await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Cardiology Clinic',
        type: PilotUnitType.CLINIC,
      },
    });

    expect(pilotUnit).toBeDefined();
    expect(pilotUnit.ehrCostCenterCode).toBeNull();
  });

  test('should create units with different types', async () => {
    const dept = await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Department',
        type: PilotUnitType.DEPT,
      },
    });

    const clinic = await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Clinic',
        type: PilotUnitType.CLINIC,
      },
    });

    const serviceLine = await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Service Line',
        type: PilotUnitType.SERVICE_LINE,
      },
    });

    expect(dept.type).toBe(PilotUnitType.DEPT);
    expect(clinic.type).toBe(PilotUnitType.CLINIC);
    expect(serviceLine.type).toBe(PilotUnitType.SERVICE_LINE);
  });

  test('should enforce unique constraint on orgId and name combination', async () => {
    await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Unique Unit',
        type: PilotUnitType.CLINIC,
      },
    });

    await expect(
      prisma.pilotUnit.create({
        data: {
          orgId: pilotOrgId,
          name: 'Unique Unit',
          type: PilotUnitType.DEPT,
        },
      })
    ).rejects.toThrow();
  });

  test('should allow same name for different orgs', async () => {
    const org2 = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Second Test Org',
        sponsorName: 'Sponsor 2',
        sponsorEmail: 'sponsor2@test.org',
      },
    });

    await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Shared Name',
        type: PilotUnitType.CLINIC,
      },
    });

    const unit2 = await prisma.pilotUnit.create({
      data: {
        orgId: org2.id,
        name: 'Shared Name',
        type: PilotUnitType.CLINIC,
      },
    });

    expect(unit2).toBeDefined();
    expect(unit2.name).toBe('Shared Name');

    await prisma.pilotOrg.delete({ where: { id: org2.id } });
  });

  test('should validate PilotUnit schema', () => {
    const validData = {
      orgId: pilotOrgId,
      name: 'Test Unit',
      type: PilotUnitType.CLINIC,
      ehrCostCenterCode: 'TEST-001',
    };

    const result = validatePilotUnit(validData);
    expect(result).toEqual(validData);
  });

  test('should reject invalid type in schema validation', () => {
    const invalidData = {
      orgId: pilotOrgId,
      name: 'Test Unit',
      type: 'INVALID_TYPE' as any,
    };

    expect(() => validatePilotUnit(invalidData)).toThrow();
  });

  test('should update PilotUnit', async () => {
    const pilotUnit = await prisma.pilotUnit.create({
      data: {
        orgId: pilotOrgId,
        name: 'Update Test Unit',
        type: PilotUnitType.CLINIC,
      },
    });

    const updated = await prisma.pilotUnit.update({
      where: { id: pilotUnit.id },
      data: {
        name: 'Updated Unit Name',
        ehrCostCenterCode: 'UPD-001',
      },
    });

    expect(updated.name).toBe('Updated Unit Name');
    expect(updated.ehrCostCenterCode).toBe('UPD-001');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(pilotUnit.updatedAt.getTime());
  });

  test('should cascade delete when PilotOrg is deleted', async () => {
    const org = await prisma.pilotOrg.create({
      data: {
        pilotName: 'Cascade Test Org',
        sponsorName: 'Sponsor',
        sponsorEmail: 'sponsor@test.org',
      },
    });

    const unit = await prisma.pilotUnit.create({
      data: {
        orgId: org.id,
        name: 'Cascade Test Unit',
        type: PilotUnitType.CLINIC,
      },
    });

    await prisma.pilotOrg.delete({
      where: { id: org.id },
    });

    const found = await prisma.pilotUnit.findUnique({
      where: { id: unit.id },
    });

    expect(found).toBeNull();
  });
});

