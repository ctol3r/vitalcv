const log = getServiceLogger('payer/leieMonitor');
/**
 * B137A-LEIE-014: LEIE monthly check integration stub
 *
 * Monitors enrollments against the OIG LEIE (List of Excluded Individuals/Entities).
 * Runs monthly to check for new exclusions and flags enrollments with LEIE hits.
 * Status changes to ON_HOLD when exclusion found, with audit event anchored.
 *
 * Real integration TODO:
 * - Connect to OIG LEIE API (https://oig.hhs.gov/exclusions/exclusions_list.asp)
 * - Implement LEIE database download and search
 * - Add SAM.gov integration for additional exclusions
 * - Implement state-specific exclusion list checks
 */

import { PrismaClient } from '@prisma/client';
import { logLeieCheck } from '../audit/payerEnrollmentEvents.js';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export interface LeieRecord {
  npi?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  businessName?: string;
  general?: string; // General category (e.g., "PHYSICIAN")
  specialty?: string;
  exclusionType: string; // e.g., "1128a1", "1128a2", "1128b4"
  exclusionDate: string;
  reinstatementDate?: string;
  waiverState?: string;
  waiverDate?: string;
}

export interface LeieCheckResult {
  found: boolean;
  records?: LeieRecord[];
  npi: string;
  clinicianDid: string;
  checkedAt: Date;
}

export interface LeieMonitorJobResult {
  success: boolean;
  enrollmentsChecked: number;
  exclusionsFound: number;
  enrollmentsOnHold: number;
  errors: string[];
  results: LeieCheckResult[];
  executedAt: Date;
}

/**
 * Checks if a provider is on the LEIE (MOCKED for demo)
 *
 * @param npi - Provider NPI number
 * @returns LEIE check result
 */
export async function checkLeie(npi: string): Promise<LeieCheckResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Mock: 2% chance of finding an exclusion
  const isExcluded = Math.random() < 0.02;

  if (isExcluded) {
    const mockRecord: LeieRecord = {
      npi,
      firstName: 'Test',
      lastName: 'Provider',
      general: 'PHYSICIAN',
      specialty: 'Internal Medicine',
      exclusionType: '1128a1', // Conviction of program-related crimes
      exclusionDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    return {
      found: true,
      records: [mockRecord],
      npi,
      clinicianDid: '', // Will be filled in by caller
      checkedAt: new Date(),
    };
  }

  return {
    found: false,
    npi,
    clinicianDid: '',
    checkedAt: new Date(),
  };
}

/**
 * Runs the monthly LEIE check job
 *
 * Checks all active enrollments against LEIE and flags any exclusions found.
 */
export async function runLeieMonitorJob(): Promise<LeieMonitorJobResult> {
  const errors: string[] = [];
  const results: LeieCheckResult[] = [];
  let exclusionsFound = 0;
  let enrollmentsOnHold = 0;
  const now = new Date();

  try {
    log.info('[LeieMonitor] Starting LEIE monthly check job...');

    // Get all approved enrollments
    const enrollments = await prisma.payerEnrollment.findMany({
      where: {
        status: {
          in: ['APPROVED', 'SUBMITTED'],
        },
      },
      include: {
        payer: true,
      },
    });

    log.info(`[LeieMonitor] Checking ${enrollments.length} enrollments`);

    for (const enrollment of enrollments) {
      try {
        // Get NPI from clinician record
        const npiClaim = await prisma.npiClaim.findFirst({
          where: {
            user: {
              did: enrollment.clinicianDid,
            },
          },
        });

        if (!npiClaim) {
          log.warn(
            `[LeieMonitor] No NPI found for clinician ${enrollment.clinicianDid}, skipping`
          );
          continue;
        }

        // Check LEIE
        const leieResult = await checkLeie(npiClaim.npi);
        leieResult.clinicianDid = enrollment.clinicianDid;
        results.push(leieResult);

        // Log LEIE check
        await logLeieCheck(enrollment.id, npiClaim.npi, {
          found: leieResult.found,
          details: leieResult.records,
        });

        // If exclusion found, update enrollment status
        if (leieResult.found) {
          exclusionsFound++;
          log.warn(
            `[LeieMonitor] LEIE exclusion found for NPI ${npiClaim.npi}, enrollment ${enrollment.id}`
          );

          // Check if already on hold
          if (enrollment.status !== 'TERMINATED') {
            await prisma.payerEnrollment.update({
              where: { id: enrollment.id },
              data: {
                status: 'TERMINATED', // Terminate enrollment on LEIE hit
                terminatedAt: new Date(),
                metadata: {
                  ...((enrollment.metadata as any) || {}),
                  leieExclusion: {
                    foundAt: now.toISOString(),
                    records: leieResult.records,
                  },
                },
              },
            });

            enrollmentsOnHold++;

            // Create NPDB/OIG monitor record
            await prisma.npdbOigMonitor.create({
              data: {
                clinicianDid: enrollment.clinicianDid,
                npi: npiClaim.npi,
                monitorType: 'OIG',
                checkDate: now,
                status: 'ADVERSE_ACTION',
                adverseActions: leieResult.records || [],
                privilegeAction: 'REVOKE',
                notificationSent: false,
                orgIds: [enrollment.orgId],
              },
            });

            // Log status change
            await prisma.payerEnrollmentEvent.create({
              data: {
                enrollmentId: enrollment.id,
                eventType: 'status_change',
                source: 'LEIE',
                result: 'FAIL',
                metadata: {
                  action: 'terminated_due_to_leie',
                  oldStatus: enrollment.status,
                  newStatus: 'TERMINATED',
                  leieRecords: leieResult.records,
                },
              },
            });

            log.info(
              `[LeieMonitor] Enrollment ${enrollment.id} terminated due to LEIE exclusion`
            );
          }
        } else {
          log.info(`[LeieMonitor] LEIE check passed for NPI ${npiClaim.npi}`);
        }
      } catch (error) {
        const errorMsg = `Failed to check LEIE for enrollment ${enrollment.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        log.error(`[LeieMonitor] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    log.info(
      `[LeieMonitor] Job completed. Checked ${enrollments.length} enrollments, found ${exclusionsFound} exclusions, ${enrollmentsOnHold} enrollments terminated`
    );

    return {
      success: errors.length === 0,
      enrollmentsChecked: enrollments.length,
      exclusionsFound,
      enrollmentsOnHold,
      errors,
      results,
      executedAt: now,
    };
  } catch (error) {
    const errorMsg = `LEIE monitor job failed: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    log.error(`[LeieMonitor] ${errorMsg}`);
    errors.push(errorMsg);

    return {
      success: false,
      enrollmentsChecked: 0,
      exclusionsFound,
      enrollmentsOnHold,
      errors,
      results,
      executedAt: now,
    };
  }
}

/**
 * Checks a specific clinician against LEIE
 */
export async function checkClinicianLeie(clinicianDid: string): Promise<LeieCheckResult | null> {
  const npiClaim = await prisma.npiClaim.findFirst({
    where: {
      user: {
        did: clinicianDid,
      },
    },
  });

  if (!npiClaim) {
    log.warn(`[LeieMonitor] No NPI found for clinician ${clinicianDid}`);
    return null;
  }

  const result = await checkLeie(npiClaim.npi);
  result.clinicianDid = clinicianDid;

  return result;
}

/**
 * Gets all enrollments with LEIE exclusions
 */
export async function getLeieExcludedEnrollments() {
  return prisma.payerEnrollment.findMany({
    where: {
      metadata: {
        path: ['leieExclusion'],
        not: null,
      },
    },
    include: {
      payer: true,
    },
    orderBy: {
      terminatedAt: 'desc',
    },
  });
}

/**
 * CLI entry point for running the job manually
 */
if (require.main === module) {
  runLeieMonitorJob()
    .then((result) => {
      log.info('\n=== LEIE Monitor Job Results ===');
      log.info(`Success: ${result.success}`);
      log.info(`Enrollments Checked: ${result.enrollmentsChecked}`);
      log.info(`Exclusions Found: ${result.exclusionsFound}`);
      log.info(`Enrollments Terminated: ${result.enrollmentsOnHold}`);
      log.info(`Errors: ${result.errors.length}`);
      if (result.errors.length > 0) {
        log.info('\nErrors:', result.errors);
      }
      if (result.exclusionsFound > 0) {
        log.info('\nExclusions:');
        result.results
          .filter((r) => r.found)
          .forEach((r) => {
            log.info(`- NPI ${r.npi}: ${r.records?.length || 0} record(s)`);
          });
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      log.error('Fatal error:', error);
      process.exit(1);
    });
}

