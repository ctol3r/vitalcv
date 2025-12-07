/**
 * Audit event helpers for privilege management
 *
 * Creates standardized audit events for privilege requests, approvals, and grants.
 * Events are logged to the AuditEvent table for compliance tracking.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface PrivilegeAuditEventParams {
  eventType: string;
  privilegeRequestId: string;
  clinicianDid: string;
  orgId: string;
  privilegeSetId: string;
  privilegeSetV2Id?: string;
  status: string;
  metadata?: Record<string, any>;
  userId?: string;
  chainTxHash?: string;
}

/**
 * Create a privilege-related audit event
 */
export async function createPrivilegeRequestAuditEvent(params: PrivilegeAuditEventParams) {
  const {
    eventType,
    privilegeRequestId,
    clinicianDid,
    orgId,
    privilegeSetId,
    status,
    metadata = {},
    userId,
    chainTxHash,
  } = params;

  return prisma.auditEvent.create({
    data: {
      type: eventType,
      subjectNpi: null, // Privilege events use DID-based identity
      userId,
      data: {
        privilegeRequestId,
        clinicianDid,
        orgId,
        privilegeSetId,
        privilegeSetV2Id,
        status,
        timestamp: new Date().toISOString(),
        ...metadata,
      } as Prisma.InputJsonValue,
      chainTxHash,
    },
  });
}

/**
 * Log privilege grant event (when privilege is actively granted)
 */
export async function logPrivilegeGrantedEvent(params: {
  privilegeGrantedId: string;
  privilegeRequestId: string;
  clinicianDid: string;
  orgId: string;
    privilegeSetId: string;
  privilegeSetV2Id?: string;
  grantedAt: Date;
  expiresAt: Date;
  vcHash?: string;
  vcCredentialId?: string;
  chainTxHash?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      type: 'PRIVILEGE_GRANTED',
      subjectNpi: null,
      data: {
        ...params,
        privilegeSetV2Id: params.privilegeSetV2Id,
        grantedAt: params.grantedAt.toISOString(),
        expiresAt: params.expiresAt.toISOString(),
      } as Prisma.InputJsonValue,
      chainTxHash: params.chainTxHash,
    },
  });
}

/**
 * Log privilege revocation event
 */
export async function logPrivilegeRevokedEvent(params: {
  privilegeGrantedId: string;
  clinicianDid: string;
  orgId: string;
  revocationReason: string;
  revokedBy: string;
  chainTxHash?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      type: 'PRIVILEGE_REVOKED',
      subjectNpi: null,
      data: {
        ...params,
        revokedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
      chainTxHash: params.chainTxHash,
    },
  });
}

/**
 * Log privilege renewal event
 */
export async function logPrivilegeRenewalEvent(params: {
  privilegeRenewalId: string;
  privilegeGrantedId: string;
  clinicianDid: string;
  orgId: string;
  dueDate: Date;
  status: string;
  chainTxHash?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      type: 'PRIVILEGE_RENEWAL',
      subjectNpi: null,
      data: {
        ...params,
        dueDate: params.dueDate.toISOString(),
        timestamp: new Date().toISOString(),
      } as Prisma.InputJsonValue,
      chainTxHash: params.chainTxHash,
    },
  });
}

/**
 * Query audit events for a specific clinician's privilege history
 */
export async function getClinicianPrivilegeAuditHistory(clinicianDid: string, limit = 50) {
  return prisma.auditEvent.findMany({
    where: {
      type: {
        in: [
          'PRIVILEGE_REQUEST_CREATED',
          'PRIVILEGE_REQUEST_APPROVED',
          'PRIVILEGE_REQUEST_DENIED',
          'PRIVILEGE_GRANTED',
          'PRIVILEGE_REVOKED',
          'PRIVILEGE_RENEWAL',
        ],
      },
      data: {
        path: ['clinicianDid'],
        equals: clinicianDid,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Query audit events for an organization's privilege activity
 */
export async function getOrgPrivilegeAuditHistory(orgId: string, limit = 100) {
  return prisma.auditEvent.findMany({
    where: {
      type: {
        in: [
          'PRIVILEGE_SET_CREATED',
          'PRIVILEGE_SET_UPDATED',
          'PRIVILEGE_REQUEST_CREATED',
          'PRIVILEGE_REQUEST_APPROVED',
          'PRIVILEGE_REQUEST_DENIED',
          'PRIVILEGE_GRANTED',
          'PRIVILEGE_REVOKED',
        ],
      },
      data: {
        path: ['orgId'],
        equals: orgId,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}
