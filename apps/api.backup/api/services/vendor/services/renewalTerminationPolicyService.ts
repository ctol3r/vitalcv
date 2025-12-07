/**
 * B240B-VM-017: Renewal Termination Policy Service
 *
 * Defines policies for contract renewals or termination:
 * - Notice periods
 * - Performance thresholds
 * - Optional auto-renew
 * - Triggers reminders and tasks
 */

import { PrismaClient, ContractStatus } from '@prisma/client';

export interface RenewalPolicy {
  vendorId: string;
  autoRenew: boolean;
  noticePeriodDays: number; // Days before expiry to send notice
  performanceThreshold?: number; // Minimum performance score (0-100) to auto-renew
  renewalTerm?: number; // Renewal term in months
}

export interface TerminationPolicy {
  vendorId: string;
  noticePeriodDays: number;
  performanceThreshold: number; // Below this score, termination may be triggered
  terminationReasons?: string[]; // Valid reasons for termination
}

export interface RenewalReminder {
  vendorId: string;
  contractId: string;
  reminderDate: Date;
  expiryDate: Date;
  daysUntilExpiry: number;
  action: 'renew' | 'review' | 'terminate';
}

/**
 * Create or update renewal policy for a vendor
 */
export async function setRenewalPolicy(
  prisma: PrismaClient,
  policy: RenewalPolicy
): Promise<void> {
  // Store policy in vendor metadata or separate table
  // For now, we'll use a JSON field approach
  const vendor = await prisma.vendor.findUnique({
    where: { id: policy.vendorId },
  });

  if (!vendor) {
    throw new Error(`Vendor ${policy.vendorId} not found`);
  }

  // In production, create a separate RenewalPolicy table
  // For now, we'll store in contract metadata
  // This is a stub implementation
}

/**
 * Create or update termination policy for a vendor
 */
export async function setTerminationPolicy(
  prisma: PrismaClient,
  policy: TerminationPolicy
): Promise<void> {
  // Store policy in vendor metadata or separate table
  // Stub implementation
}

/**
 * Check contracts approaching expiry and generate reminders
 */
export async function generateRenewalReminders(
  prisma: PrismaClient,
  daysAhead: number = 30
): Promise<RenewalReminder[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  // Find contracts expiring within the specified period
  const contracts = await prisma.vendorContract.findMany({
    where: {
      status: ContractStatus.SIGNED,
      expiresAt: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      vendor: true,
    },
  });

  const reminders: RenewalReminder[] = [];

  for (const contract of contracts) {
    if (!contract.expiresAt) {
      continue;
    }

    const daysUntilExpiry = Math.floor(
      (contract.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine action based on days until expiry
    let action: 'renew' | 'review' | 'terminate' = 'review';
    if (daysUntilExpiry <= 7) {
      action = 'renew';
    } else if (daysUntilExpiry <= 14) {
      action = 'review';
    }

    // Check if renewal alert is already set
    if (contract.renewalAlertAt && contract.renewalAlertAt <= now) {
      reminders.push({
        vendorId: contract.vendorId,
        contractId: contract.id,
        reminderDate: contract.renewalAlertAt,
        expiryDate: contract.expiresAt,
        daysUntilExpiry,
        action,
      });
    } else {
      // Set renewal alert if not already set
      await prisma.vendorContract.update({
        where: { id: contract.id },
        data: {
          renewalAlertAt: new Date(now.getTime() + (daysUntilExpiry - 30) * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  return reminders;
}

/**
 * Evaluate if contract should be auto-renewed based on policy and performance
 */
export async function evaluateAutoRenewal(
  prisma: PrismaClient,
  contractId: string
): Promise<{
  shouldRenew: boolean;
  reason: string;
  performanceScore?: number;
}> {
  const contract = await prisma.vendorContract.findUnique({
    where: { id: contractId },
    include: {
      vendor: {
        include: {
          performanceMetrics: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!contract || !contract.expiresAt) {
    return {
      shouldRenew: false,
      reason: 'Contract not found or has no expiry date',
    };
  }

  // Check if auto-renew is enabled (would check policy)
  // For now, stub implementation
  const autoRenew = false; // Would check RenewalPolicy
  const performanceThreshold = 70; // Would get from policy

  if (!autoRenew) {
    return {
      shouldRenew: false,
      reason: 'Auto-renewal is not enabled for this vendor',
    };
  }

  // Check performance threshold
  // Get latest performance score (would use VendorPerformanceDashboardService)
  const latestMetric = contract.vendor.performanceMetrics[0];
  const performanceScore = latestMetric?.value ?? 0;

  if (performanceScore < performanceThreshold) {
    return {
      shouldRenew: false,
      reason: `Performance score ${performanceScore} is below threshold ${performanceThreshold}`,
      performanceScore,
    };
  }

  return {
    shouldRenew: true,
    reason: 'Meets auto-renewal criteria',
    performanceScore,
  };
}

/**
 * Check if vendor should be considered for termination based on performance
 */
export async function evaluateTermination(
  prisma: PrismaClient,
  vendorId: string
): Promise<{
  shouldTerminate: boolean;
  reason: string;
  performanceScore?: number;
  riskScore?: number;
}> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      riskScores: {
        take: 1,
        orderBy: { calculatedAt: 'desc' },
      },
      performanceMetrics: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!vendor) {
    return {
      shouldTerminate: false,
      reason: 'Vendor not found',
    };
  }

  // Get termination policy (would check TerminationPolicy)
  const performanceThreshold = 50; // Would get from policy
  const riskThreshold = 80; // Would get from policy

  const performanceScore = vendor.performanceMetrics[0]?.value ?? 0;
  const riskScore = vendor.riskScores[0]?.score ?? 0;

  // Check performance threshold
  if (performanceScore < performanceThreshold) {
    return {
      shouldTerminate: true,
      reason: `Performance score ${performanceScore} is below termination threshold ${performanceThreshold}`,
      performanceScore,
      riskScore,
    };
  }

  // Check risk threshold
  if (riskScore > riskThreshold) {
    return {
      shouldTerminate: true,
      reason: `Risk score ${riskScore} exceeds termination threshold ${riskThreshold}`,
      performanceScore,
      riskScore,
    };
  }

  return {
    shouldTerminate: false,
    reason: 'Vendor meets minimum requirements',
    performanceScore,
    riskScore,
  };
}

/**
 * Trigger contract renewal
 */
export async function triggerContractRenewal(
  prisma: PrismaClient,
  contractId: string,
  newExpiryDate: Date
): Promise<any> {
  return prisma.vendorContract.update({
    where: { id: contractId },
    data: {
      expiresAt: newExpiryDate,
      renewalAlertAt: null, // Reset alert
      updatedAt: new Date(),
    },
  });
}

/**
 * Schedule renewal reminder tasks
 */
export async function scheduleRenewalTasks(
  prisma: PrismaClient
): Promise<RenewalReminder[]> {
  // Generate reminders for contracts expiring in next 30 days
  const reminders = await generateRenewalReminders(prisma, 30);

  // In production, would create tasks in a task management system
  // For now, return reminders

  return reminders;
}

