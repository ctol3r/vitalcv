const log = getServiceLogger('policy/models/OrgPolicyAcceptance');
/**
 * B141A-POLICY-006: OrgPolicyAcceptance model
 * Tracks organization-level policy acceptances with audit trail
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { getServiceLogger } from '../../logging/serviceLogger';

const prisma = new PrismaClient();

/**
 * Record policy acceptance by organization
 */
export async function recordPolicyAcceptance(
  orgId: string,
  policyVersionId: string,
  acceptedBy: string,
  acceptedByName?: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, any>
) {
  // Check if policy version exists and is active
  const policy = await prisma.platformPolicyVersion.findUnique({
    where: { id: policyVersionId },
  });

  if (!policy) {
    throw new Error('Policy version not found');
  }

  if (!policy.isActive) {
    throw new Error('Cannot accept inactive policy version');
  }

  // Create acceptance record
  const acceptance = await prisma.orgPolicyAcceptance.create({
    data: {
      orgId,
      policyVersionId,
      acceptedBy,
      acceptedByName,
      ipAddress,
      userAgent,
      metadata,
    },
    include: {
      policyVersion: true,
    },
  });

  // Generate hash for on-chain anchoring
  const anchoredHash = generateAcceptanceHash(acceptance);

  // Update with hash (in production, would anchor to blockchain)
  const updatedAcceptance = await prisma.orgPolicyAcceptance.update({
    where: { id: acceptance.id },
    data: { anchoredTxHash: anchoredHash },
    include: {
      policyVersion: true,
    },
  });

  // Create audit event for policy acceptance
  await prisma.auditEvent.create({
    data: {
      type: 'POLICY_ACCEPTED',
      data: {
        orgId,
        policyName: policy.name,
        policyVersion: policy.version,
        acceptedBy,
        acceptedByName,
        acceptanceId: acceptance.id,
      },
    },
  });

  return updatedAcceptance;
}

/**
 * Generate hash for policy acceptance (for on-chain anchoring)
 */
function generateAcceptanceHash(acceptance: any): string {
  const data = {
    id: acceptance.id,
    orgId: acceptance.orgId,
    policyVersionId: acceptance.policyVersionId,
    acceptedBy: acceptance.acceptedBy,
    acceptedAt: acceptance.acceptedAt.toISOString(),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Get organization's policy acceptances
 */
export async function getOrgPolicyAcceptances(orgId: string) {
  return await prisma.orgPolicyAcceptance.findMany({
    where: { orgId },
    include: {
      policyVersion: {
        select: {
          id: true,
          name: true,
          version: true,
          summary: true,
          effectiveAt: true,
        },
      },
    },
    orderBy: {
      acceptedAt: 'desc',
    },
  });
}

/**
 * Check if organization has accepted a specific policy
 */
export async function hasOrgAcceptedPolicy(
  orgId: string,
  policyName: string
): Promise<boolean> {
  const policy = await prisma.platformPolicyVersion.findFirst({
    where: {
      name: policyName,
      isActive: true,
    },
  });

  if (!policy) {
    return false;
  }

  const acceptance = await prisma.orgPolicyAcceptance.findUnique({
    where: {
      orgId_policyVersionId: {
        orgId,
        policyVersionId: policy.id,
      },
    },
  });

  return !!acceptance;
}

/**
 * Get acceptance status for all active policies
 */
export async function getPolicyAcceptanceStatus(orgId: string) {
  const activePolicies = await prisma.platformPolicyVersion.findMany({
    where: {
      isActive: true,
      effectiveAt: { lte: new Date() },
    },
  });

  const acceptances = await prisma.orgPolicyAcceptance.findMany({
    where: {
      orgId,
      policyVersionId: {
        in: activePolicies.map((p) => p.id),
      },
    },
  });

  const acceptanceMap = new Map(
    acceptances.map((a) => [a.policyVersionId, a])
  );

  return activePolicies.map((policy) => ({
    policy: {
      id: policy.id,
      name: policy.name,
      version: policy.version,
      summary: policy.summary,
      effectiveAt: policy.effectiveAt,
    },
    accepted: acceptanceMap.has(policy.id),
    acceptance: acceptanceMap.get(policy.id) || null,
  }));
}

/**
 * Get organizations that haven't accepted a specific policy
 */
export async function getOrgsWithoutPolicyAcceptance(
  policyVersionId: string,
  orgIds?: string[]
) {
  const acceptances = await prisma.orgPolicyAcceptance.findMany({
    where: {
      policyVersionId,
      ...(orgIds && { orgId: { in: orgIds } }),
    },
    select: { orgId: true },
  });

  const acceptedOrgIds = new Set(acceptances.map((a) => a.orgId));

  if (orgIds) {
    return orgIds.filter((orgId) => !acceptedOrgIds.has(orgId));
  }

  // If no specific orgIds provided, would need to query all orgs
  // This is a placeholder - implement based on your org management system
  return [];
}

/**
 * Revoke policy acceptance (for testing/admin purposes)
 */
export async function revokePolicyAcceptance(
  orgId: string,
  policyVersionId: string
) {
  const acceptance = await prisma.orgPolicyAcceptance.findUnique({
    where: {
      orgId_policyVersionId: {
        orgId,
        policyVersionId,
      },
    },
  });

  if (!acceptance) {
    throw new Error('Acceptance record not found');
  }

  await prisma.orgPolicyAcceptance.delete({
    where: { id: acceptance.id },
  });

  // Create audit event for revocation
  await prisma.auditEvent.create({
    data: {
      type: 'POLICY_ACCEPTANCE_REVOKED',
      data: {
        orgId,
        policyVersionId,
        acceptanceId: acceptance.id,
        revokedAt: new Date().toISOString(),
      },
    },
  });

  return acceptance;
}

/**
 * Get acceptance by ID
 */
export async function getAcceptanceById(acceptanceId: string) {
  return await prisma.orgPolicyAcceptance.findUnique({
    where: { id: acceptanceId },
    include: {
      policyVersion: true,
    },
  });
}

/**
 * Bulk accept multiple policies for an organization
 */
export async function bulkAcceptPolicies(
  orgId: string,
  policyVersionIds: string[],
  acceptedBy: string,
  acceptedByName?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const acceptances = [];

  for (const policyVersionId of policyVersionIds) {
    try {
      const acceptance = await recordPolicyAcceptance(
        orgId,
        policyVersionId,
        acceptedBy,
        acceptedByName,
        ipAddress,
        userAgent
      );
      acceptances.push(acceptance);
    } catch (error) {
      log.error(
        `Failed to accept policy ${policyVersionId}:`,
        error
      );
      // Continue with other policies
    }
  }

  return acceptances;
}

