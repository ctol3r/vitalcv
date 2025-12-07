/**
 * B141A-POLICY-005: PlatformPolicyVersion model
 * Manages versioned platform policies (Security, Privacy, DataUse)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Policy types
 */
export enum PolicyType {
  SECURITY = 'Security Policy',
  PRIVACY = 'Privacy Policy',
  DATA_USE = 'Data Use Policy',
  TERMS_OF_SERVICE = 'Terms of Service',
}

/**
 * Create a new policy version
 */
export async function createPolicyVersion(
  name: string,
  version: string,
  content: string,
  effectiveAt: Date,
  createdBy?: string,
  summary?: string,
  changeNotes?: string
) {
  return await prisma.platformPolicyVersion.create({
    data: {
      name,
      version,
      content,
      summary,
      effectiveAt,
      changeNotes,
      createdBy,
      isActive: true,
    },
  });
}

/**
 * Get active policy version by name
 */
export async function getActivePolicyVersion(name: string) {
  const now = new Date();

  return await prisma.platformPolicyVersion.findFirst({
    where: {
      name,
      isActive: true,
      effectiveAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: {
      effectiveAt: 'desc',
    },
  });
}

/**
 * Get all active policies
 */
export async function getAllActivePolicies() {
  const now = new Date();

  return await prisma.platformPolicyVersion.findMany({
    where: {
      isActive: true,
      effectiveAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ name: 'asc' }, { effectiveAt: 'desc' }],
  });
}

/**
 * Get policy version history
 */
export async function getPolicyVersionHistory(name: string) {
  return await prisma.platformPolicyVersion.findMany({
    where: { name },
    orderBy: {
      effectiveAt: 'desc',
    },
  });
}

/**
 * Get specific policy version
 */
export async function getPolicyVersionById(id: string) {
  return await prisma.platformPolicyVersion.findUnique({
    where: { id },
    include: {
      acceptances: {
        orderBy: { acceptedAt: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * Deactivate old policy version (when new version is created)
 */
export async function deactivatePolicyVersion(id: string, expiresAt?: Date) {
  return await prisma.platformPolicyVersion.update({
    where: { id },
    data: {
      isActive: false,
      expiresAt: expiresAt || new Date(),
    },
  });
}

/**
 * Seed initial policy versions
 */
export async function seedInitialPolicies() {
  const now = new Date();
  const policies = [];

  // Security Policy v1.0.0
  const securityPolicy = await prisma.platformPolicyVersion.upsert({
    where: {
      name_version: {
        name: PolicyType.SECURITY,
        version: '1.0.0',
      },
    },
    update: {},
    create: {
      name: PolicyType.SECURITY,
      version: '1.0.0',
      content: `# Security Policy v1.0.0

## Overview
This Security Policy outlines the security practices and requirements for using the Chai VC Platform.

## Data Protection
- All data is encrypted at rest and in transit
- Access controls enforce least privilege principle
- Multi-factor authentication required for sensitive operations

## Incident Response
- Security incidents must be reported within 24 hours
- All incidents are logged and investigated
- Affected parties will be notified per regulatory requirements

## Compliance
- HIPAA compliance for all PHI
- SOC 2 Type II certified infrastructure
- Regular security audits and penetration testing

Effective Date: ${now.toISOString().split('T')[0]}`,
      summary: 'Initial security policy covering data protection, incident response, and compliance.',
      effectiveAt: now,
      isActive: true,
      createdBy: 'system',
    },
  });
  policies.push(securityPolicy);

  // Privacy Policy v1.0.0
  const privacyPolicy = await prisma.platformPolicyVersion.upsert({
    where: {
      name_version: {
        name: PolicyType.PRIVACY,
        version: '1.0.0',
      },
    },
    update: {},
    create: {
      name: PolicyType.PRIVACY,
      version: '1.0.0',
      content: `# Privacy Policy v1.0.0

## Overview
This Privacy Policy describes how we collect, use, and protect your personal information.

## Information Collection
- We collect only information necessary for service provision
- User consent is required for data collection
- Data minimization principles applied

## Information Use
- Data used solely for stated purposes
- No sale or sharing without explicit consent
- Aggregate analytics for service improvement

## User Rights
- Right to access personal data
- Right to correction and deletion
- Right to data portability
- Right to opt-out of non-essential processing

## Third Parties
- Limited third-party sharing for service delivery
- All third parties contractually bound to privacy standards

Effective Date: ${now.toISOString().split('T')[0]}`,
      summary: 'Privacy policy covering information collection, use, and user rights.',
      effectiveAt: now,
      isActive: true,
      createdBy: 'system',
    },
  });
  policies.push(privacyPolicy);

  // Data Use Policy v1.0.0
  const dataUsePolicy = await prisma.platformPolicyVersion.upsert({
    where: {
      name_version: {
        name: PolicyType.DATA_USE,
        version: '1.0.0',
      },
    },
    update: {},
    create: {
      name: PolicyType.DATA_USE,
      version: '1.0.0',
      content: `# Data Use Policy v1.0.0

## Overview
This Data Use Policy governs how organizations and users may use platform data.

## Permitted Uses
- Credentialing and privileging
- Healthcare workforce optimization
- Regulatory compliance and reporting
- Quality improvement initiatives

## Prohibited Uses
- Sale of credentialing data
- Marketing without consent
- Discrimination based on protected characteristics
- Unauthorized disclosure of PHI

## Data Retention
- Credentialing records: 7 years
- Audit logs: 10 years
- Temporary data: 90 days unless required longer

## Compliance Requirements
- HIPAA compliance mandatory for PHI access
- State licensing board requirements
- Payer credentialing standards (NCQA, URAC)

Effective Date: ${now.toISOString().split('T')[0]}`,
      summary: 'Data use policy covering permitted uses, prohibitions, and compliance requirements.',
      effectiveAt: now,
      isActive: true,
      createdBy: 'system',
    },
  });
  policies.push(dataUsePolicy);

  return policies;
}

/**
 * Update policy version (for metadata only, content changes should create new version)
 */
export async function updatePolicyMetadata(
  id: string,
  updates: {
    summary?: string;
    changeNotes?: string;
    isActive?: boolean;
  }
) {
  return await prisma.platformPolicyVersion.update({
    where: { id },
    data: updates,
  });
}

/**
 * Get policies requiring acceptance by organization
 * Returns policies not yet accepted by the org
 */
export async function getPoliciesRequiringAcceptance(orgId: string) {
  const activePolicies = await getAllActivePolicies();
  const acceptedPolicies = await prisma.orgPolicyAcceptance.findMany({
    where: { orgId },
    select: { policyVersionId: true },
  });

  const acceptedIds = new Set(
    acceptedPolicies.map((a) => a.policyVersionId)
  );

  return activePolicies.filter((policy) => !acceptedIds.has(policy.id));
}

