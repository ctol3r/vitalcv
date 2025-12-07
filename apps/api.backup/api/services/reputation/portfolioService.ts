/**
 * B224A-REP-003: CredentialPortfolioService
 *
 * Stores and retrieves a clinician's credentials, privileges, enrollments, and endorsements.
 * Supports merging state and compact credentials. Provides API to update on events.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Portfolio data structure
 */
export interface CredentialPortfolio {
  clinicianId: string;
  credentials: Credential[];
  privileges: Privilege[];
  enrollments: Enrollment[];
  endorsements: Endorsement[];
  qualityScore: number; // 0-100
  credentialScore: number; // 0-100
  enrollmentScore: number; // 0-100
  peerReviewsScore: number; // 0-100
  driftPenalty: number; // 0-1 penalty multiplier
  auditScore: number; // 0-100
  updatedAt: Date;
}

export interface Credential {
  id: string;
  type: string; // 'license', 'certification', 'degree', etc.
  issuer: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  issuedAt?: Date;
  expiresAt?: Date;
  evidenceUrl?: string;
  metadata?: Record<string, any>;
}

export interface Privilege {
  id: string;
  privilegeCode: string;
  orgId: string;
  status: 'active' | 'hold' | 'suspended' | 'revoked';
  grantedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface Enrollment {
  id: string;
  type: 'payer' | 'medicaid' | 'pecos';
  payerId?: string;
  state?: string;
  status: 'enrolled' | 'pending' | 'rejected' | 'terminated';
  enrolledAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface Endorsement {
  id: string;
  endorserId: string;
  type: string;
  status: 'active' | 'revoked';
  issuedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Get portfolio for a clinician
 */
export async function getPortfolio(clinicianId: string): Promise<CredentialPortfolio> {
  // Fetch credentials from Prisma
  const credentials = await prisma.credential.findMany({
    where: {
      userId: clinicianId, // Assuming clinicianId maps to userId
      status: { not: 'revoked' },
    },
    orderBy: { issuedAt: 'desc' },
  });

  // Fetch privileges
  const privileges = await prisma.privilegeGranted.findMany({
    where: {
      clinicianDid: clinicianId,
      status: { not: 'REVOKED' },
    },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true,
        },
      },
    },
    orderBy: { grantedAt: 'desc' },
  });

  // Fetch payer enrollments
  const payerEnrollments = await prisma.payerEnrollment.findMany({
    where: {
      clinicianDid: clinicianId,
      status: { not: 'TERMINATED' },
    },
    include: {
      payer: true,
    },
    orderBy: { submittedAt: 'desc' },
  });

  // Fetch PECOS enrollments
  const pecosEnrollments = await prisma.pECOSEnrollment.findMany({
    where: {
      clinicianId,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform to portfolio format
  const portfolioCredentials: Credential[] = credentials.map((cred) => ({
    id: cred.id,
    type: cred.type,
    issuer: cred.issuer,
    status: cred.status.toLowerCase() as 'active' | 'expired' | 'revoked' | 'pending',
    issuedAt: cred.issuedAt,
    expiresAt: cred.expiresAt ?? undefined,
    metadata: {},
  }));

  const portfolioPrivileges: Privilege[] = privileges.map((priv) => ({
    id: priv.id,
    privilegeCode: priv.privilegeSetId,
    orgId: priv.orgId,
    status: priv.status.toLowerCase() as 'active' | 'hold' | 'suspended' | 'revoked',
    grantedAt: priv.grantedAt,
    expiresAt: priv.expiresAt,
    metadata: {},
  }));

  const portfolioEnrollments: Enrollment[] = [
    ...payerEnrollments.map((enroll) => ({
      id: enroll.id,
      type: 'payer' as const,
      payerId: enroll.payerId,
      status: enroll.status.toLowerCase() as 'enrolled' | 'pending' | 'rejected' | 'terminated',
      enrolledAt: enroll.approvedAt ?? undefined,
      expiresAt: enroll.revalidationDueAt ?? undefined,
      metadata: {},
    })),
    ...pecosEnrollments.map((enroll) => ({
      id: enroll.id,
      type: 'pecos' as const,
      status: enroll.currentStatus.toLowerCase() as 'enrolled' | 'pending' | 'rejected' | 'terminated',
      enrolledAt: enroll.createdAt,
      expiresAt: enroll.revalidationDueAt ?? undefined,
      metadata: {},
    })),
  ];

  // Calculate scores (simplified - in production, these would come from other services)
  const qualityScore = calculateQualityScore(portfolioCredentials, portfolioPrivileges);
  const credentialScore = calculateCredentialScore(portfolioCredentials);
  const enrollmentScore = calculateEnrollmentScore(portfolioEnrollments);
  const peerReviewsScore = 0; // Would come from peer review service
  const driftPenalty = 0; // Would come from drift detection service
  const auditScore = 0; // Would come from audit service

  return {
    clinicianId,
    credentials: portfolioCredentials,
    privileges: portfolioPrivileges,
    enrollments: portfolioEnrollments,
    endorsements: [], // Would fetch from endorsements table if it exists
    qualityScore,
    credentialScore,
    enrollmentScore,
    peerReviewsScore,
    driftPenalty,
    auditScore,
    updatedAt: new Date(),
  };
}

/**
 * Update portfolio on event
 */
export async function updatePortfolioOnEvent(
  clinicianId: string,
  eventType: string,
  eventData: Record<string, any>
): Promise<void> {
  // This would handle various event types and update the portfolio accordingly
  // For now, it's a placeholder that can be extended

  switch (eventType) {
    case 'credential.issued':
    case 'credential.revoked':
    case 'privilege.granted':
    case 'privilege.revoked':
    case 'enrollment.approved':
    case 'enrollment.terminated':
      // Portfolio will be recomputed on next access
      break;
    default:
      // Unknown event type
      break;
  }
}

/**
 * Merge portfolio state (for compact credentials)
 */
export async function mergePortfolioState(
  clinicianId: string,
  compactState: Partial<CredentialPortfolio>
): Promise<CredentialPortfolio> {
  const existing = await getPortfolio(clinicianId);

  // Merge credentials
  const mergedCredentials = [
    ...existing.credentials,
    ...(compactState.credentials ?? []),
  ].filter(
    (cred, index, self) =>
      index === self.findIndex((c) => c.id === cred.id && c.type === cred.type)
  );

  // Merge privileges
  const mergedPrivileges = [
    ...existing.privileges,
    ...(compactState.privileges ?? []),
  ].filter(
    (priv, index, self) =>
      index === self.findIndex((p) => p.id === priv.id && p.privilegeCode === priv.privilegeCode)
  );

  // Merge enrollments
  const mergedEnrollments = [
    ...existing.enrollments,
    ...(compactState.enrollments ?? []),
  ].filter(
    (enroll, index, self) =>
      index === self.findIndex((e) => e.id === enroll.id && e.type === enroll.type)
  );

  return {
    ...existing,
    credentials: mergedCredentials,
    privileges: mergedPrivileges,
    enrollments: mergedEnrollments,
    updatedAt: new Date(),
  };
}

/**
 * Get compact credentials (minimal representation)
 */
export async function getCompactCredentials(clinicianId: string): Promise<{
  credentials: Array<{ type: string; status: string }>;
  privileges: Array<{ privilegeCode: string; status: string }>;
  enrollments: Array<{ type: string; status: string }>;
}> {
  const portfolio = await getPortfolio(clinicianId);

  return {
    credentials: portfolio.credentials.map((c) => ({
      type: c.type,
      status: c.status,
    })),
    privileges: portfolio.privileges.map((p) => ({
      privilegeCode: p.privilegeCode,
      status: p.status,
    })),
    enrollments: portfolio.enrollments.map((e) => ({
      type: e.type,
      status: e.status,
    })),
  };
}

// Helper functions for score calculation

function calculateQualityScore(
  credentials: Credential[],
  privileges: Privilege[]
): number {
  // Simplified: based on active credentials and privileges
  const activeCredentials = credentials.filter((c) => c.status === 'active').length;
  const activePrivileges = privileges.filter((p) => p.status === 'active').length;
  const total = credentials.length + privileges.length;

  if (total === 0) return 0;
  return ((activeCredentials + activePrivileges) / total) * 100;
}

function calculateCredentialScore(credentials: Credential[]): number {
  // Simplified: based on active, non-expired credentials
  const now = new Date();
  const validCredentials = credentials.filter(
    (c) => c.status === 'active' && (!c.expiresAt || c.expiresAt > now)
  ).length;

  if (credentials.length === 0) return 0;
  return (validCredentials / credentials.length) * 100;
}

function calculateEnrollmentScore(enrollments: Enrollment[]): number {
  // Simplified: based on active enrollments
  const activeEnrollments = enrollments.filter((e) => e.status === 'enrolled').length;

  if (enrollments.length === 0) return 0;
  return (activeEnrollments / enrollments.length) * 100;
}

