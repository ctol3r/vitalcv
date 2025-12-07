/**
 * S72-POST-3A-005: Pilot metrics per unit (jobs, applications, privileges, enrollments)
 *
 * Given pilotUnitId, returns counts for jobs, applications, privileges, payerEnrollments
 * Unit tests with seeded demo data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PilotUnitMetrics {
  pilotUnitId: string;
  unitName: string;
  jobs: number;
  applications: number;
  privileges: number;
  payerEnrollments: number;
}

/**
 * Get metrics for a pilot unit
 */
export async function getPilotUnitMetrics(pilotUnitId: string): Promise<PilotUnitMetrics | null> {
  // Get the pilot unit
  const pilotUnit = await prisma.pilotUnit.findUnique({
    where: { id: pilotUnitId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!pilotUnit) {
    return null;
  }

  // Count jobs for this unit
  const jobsCount = await prisma.jobPosting.count({
    where: {
      pilotUnitId: pilotUnitId,
    },
  });

  // Count applications for jobs in this unit
  const applicationsCount = await prisma.application.count({
    where: {
      job: {
        pilotUnitId: pilotUnitId,
      },
    },
  });

  // Count privileges (PrivilegeGranted) - this is a bit tricky since privileges are org-level
  // For now, we'll count privileges for the org that owns this unit
  // In a real implementation, you might want to link privileges to units more directly
  const pilotOrg = await prisma.pilotUnit.findUnique({
    where: { id: pilotUnitId },
    select: { orgId: true },
  });

  // Note: PrivilegeGranted doesn't have a direct link to PilotUnit
  // This is a placeholder - you may need to add a unitId field to PrivilegeGranted
  // or use a different approach based on your business logic
  const privilegesCount = 0; // TODO: Implement when privilege-unit relationship is defined

  // Count payer enrollments - count enrollments linked to applications for jobs in this unit
  // Note: PayerEnrollment has a relation to Application via payerEnrollmentId
  const applicationsInUnit = await prisma.application.findMany({
    where: {
      job: {
        pilotUnitId: pilotUnitId,
      },
    },
    select: {
      payerEnrollmentId: true,
    },
  });

  const uniqueEnrollmentIds = [...new Set(
    applicationsInUnit
      .map(app => app.payerEnrollmentId)
      .filter((id): id is string => id !== null)
  )];

  const payerEnrollmentsCount = uniqueEnrollmentIds.length;

  return {
    pilotUnitId: pilotUnit.id,
    unitName: pilotUnit.name,
    jobs: jobsCount,
    applications: applicationsCount,
    privileges: privilegesCount,
    payerEnrollments: payerEnrollmentsCount,
  };
}

/**
 * Get metrics for all units in a pilot org
 */
export async function getPilotOrgMetrics(orgId: string): Promise<PilotUnitMetrics[]> {
  const units = await prisma.pilotUnit.findMany({
    where: { orgId },
    select: { id: true },
  });

  const metrics = await Promise.all(
    units.map(unit => getPilotUnitMetrics(unit.id))
  );

  return metrics.filter((m): m is PilotUnitMetrics => m !== null);
}

