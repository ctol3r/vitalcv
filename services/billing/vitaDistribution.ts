/**
 * S72-STRETCH-E-002: VITA Distribution Engine
 *
 * Splits fees between platform and organization based on:
 * - grossRevenue: Total revenue amount
 * - OrgRevenueShare: Organization's revenue share configuration
 *
 * Returns {orgShare, platformShare} with boundary case handling and caps
 */

import { PrismaClient } from '@prisma/client';
import { getOrgRevenueShare, OrgRevenueShare } from './models/OrgRevenueShare';

export interface DistributionResult {
  orgShare: number; // Amount in cents
  platformShare: number; // Amount in cents
  appliedFloor?: boolean; // Whether minGuarantee was applied
  appliedCap?: boolean; // Whether maxCap was applied
}

/**
 * Calculate distribution of revenue between organization and platform
 *
 * @param grossRevenue - Total revenue in cents
 * @param revenueShare - Organization revenue share configuration
 * @returns Distribution result with orgShare and platformShare
 */
export function calculateDistribution(
  grossRevenue: number,
  revenueShare: OrgRevenueShare
): DistributionResult {
  if (grossRevenue < 0) {
    throw new Error(`grossRevenue must be non-negative, got ${grossRevenue}`);
  }

  // Calculate percentage (basisPoints / 10000)
  const percentage = revenueShare.basisPoints / 10000;

  // Calculate base org share
  let orgShare = Math.round(grossRevenue * percentage);
  let appliedFloor = false;
  let appliedCap = false;

  // Apply minimum guarantee (floor)
  if (revenueShare.minGuarantee !== null && orgShare < revenueShare.minGuarantee) {
    orgShare = revenueShare.minGuarantee;
    appliedFloor = true;
  }

  // Apply maximum cap
  if (revenueShare.maxCap !== null && orgShare > revenueShare.maxCap) {
    orgShare = revenueShare.maxCap;
    appliedCap = true;
  }

  // Platform gets the remainder
  let platformShare = grossRevenue - orgShare;

  // Ensure non-negative shares
  if (orgShare < 0) orgShare = 0;
  if (platformShare < 0) platformShare = 0;

  return {
    orgShare,
    platformShare,
    appliedFloor,
    appliedCap,
  };
}

/**
 * Calculate distribution using orgId (fetches revenue share config)
 */
export async function calculateDistributionForOrg(
  prisma: PrismaClient,
  grossRevenue: number,
  orgId: string
): Promise<DistributionResult> {
  const revenueShare = await getOrgRevenueShare(prisma, orgId);

  if (!revenueShare) {
    // Default: platform gets 100% if no revenue share configured
    return {
      orgShare: 0,
      platformShare: grossRevenue,
    };
  }

  return calculateDistribution(grossRevenue, revenueShare);
}

/**
 * Boundary case tests helper: Test various scenarios
 */
export function testBoundaryCases(): {
  testCase: string;
  grossRevenue: number;
  basisPoints: number;
  minGuarantee?: number;
  maxCap?: number;
  expectedOrgShare: number;
  expectedPlatformShare: number;
}[] {
  return [
    {
      testCase: 'Zero revenue',
      grossRevenue: 0,
      basisPoints: 5000, // 50%
      minGuarantee: undefined,
      maxCap: undefined,
      expectedOrgShare: 0,
      expectedPlatformShare: 0,
    },
    {
      testCase: '100% to org',
      grossRevenue: 10000,
      basisPoints: 10000, // 100%
      minGuarantee: undefined,
      maxCap: undefined,
      expectedOrgShare: 10000,
      expectedPlatformShare: 0,
    },
    {
      testCase: '0% to org',
      grossRevenue: 10000,
      basisPoints: 0, // 0%
      minGuarantee: undefined,
      maxCap: undefined,
      expectedOrgShare: 0,
      expectedPlatformShare: 10000,
    },
    {
      testCase: 'Floor applied',
      grossRevenue: 1000,
      basisPoints: 1000, // 10% = 100 cents
      minGuarantee: 500, // Floor of 500
      maxCap: undefined,
      expectedOrgShare: 500, // Floor applied
      expectedPlatformShare: 500,
    },
    {
      testCase: 'Cap applied',
      grossRevenue: 100000,
      basisPoints: 5000, // 50% = 50000 cents
      minGuarantee: undefined,
      maxCap: 20000, // Cap of 20000
      expectedOrgShare: 20000, // Cap applied
      expectedPlatformShare: 80000,
    },
    {
      testCase: 'Both floor and cap',
      grossRevenue: 50000,
      basisPoints: 3000, // 30% = 15000 cents
      minGuarantee: 10000, // Floor
      maxCap: 20000, // Cap
      expectedOrgShare: 15000, // Within range
      expectedPlatformShare: 35000,
    },
    {
      testCase: 'Floor above calculated',
      grossRevenue: 1000,
      basisPoints: 500, // 5% = 50 cents
      minGuarantee: 200, // Floor above calculated
      maxCap: undefined,
      expectedOrgShare: 200, // Floor applied
      expectedPlatformShare: 800,
    },
    {
      testCase: 'Cap below calculated',
      grossRevenue: 100000,
      basisPoints: 8000, // 80% = 80000 cents
      minGuarantee: undefined,
      maxCap: 50000, // Cap below calculated
      expectedOrgShare: 50000, // Cap applied
      expectedPlatformShare: 50000,
    },
  ];
}

