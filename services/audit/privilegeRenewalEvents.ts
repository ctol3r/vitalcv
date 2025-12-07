const log = getServiceLogger('audit/privilegeRenewalEvents');
/**
 * B135A-AUD-010: PrivilegeRenewal Audit Events
 *
 * Audit logging for privilege renewal lifecycle:
 * - created: New renewal record created
 * - notified: Notification sent to org/clinician
 * - completed: Renewal approved/denied
 * - overdue: Renewal past due date
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export type PrivilegeRenewalEventType =
  | 'RENEWAL_CREATED'
  | 'RENEWAL_NOTIFIED'
  | 'RENEWAL_COMPLETED'
  | 'RENEWAL_OVERDUE'
  | 'RENEWAL_APPROVED'
  | 'RENEWAL_DENIED'
  | 'PRIVILEGE_AUTO_HOLD_NPDB'
  | 'PRIVILEGE_AUTO_HOLD_LEIE'
  | 'TEMPORARY_PRIVILEGE_GRANTED'
  | 'TEMPORARY_PRIVILEGE_EXPIRED';

export interface PrivilegeRenewalEventData {
  renewalId?: string;
  privilegeGrantedId?: string;
  clinicianDid: string;
  orgId: string;
  reviewerId?: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  notificationsSent?: number;
  dueDate?: Date;
  [key: string]: any; // Allow additional fields
}

export interface AuditEventResult {
  id: string;
  eventType: string;
  timestamp: Date;
}

/**
 * Log a privilege renewal event to audit trail
 */
export async function logPrivilegeRenewalEvent(
  eventType: PrivilegeRenewalEventType,
  eventData: PrivilegeRenewalEventData,
  orgId: string,
  subjectDid?: string
): Promise<AuditEventResult> {
  log.info(`[AuditEvent] ${eventType}`, {
    renewalId: eventData.renewalId,
    privilegeGrantedId: eventData.privilegeGrantedId,
    clinicianDid: eventData.clinicianDid,
    orgId
  });

  // Create audit event record
  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: eventType,
      subjectNpi: subjectDid,
      data: {
        eventType,
        ...eventData,
        timestamp: new Date().toISOString()
      },
      chainTxHash: null, // TODO: Anchor to blockchain
      createdAt: new Date()
    }
  });

  // TODO: In production, batch audit events for on-chain anchoring
  // This would create a Merkle tree of audit events and anchor the root
  // See: backend/src/blockchain/audit_scrapbook.ts

  return {
    id: auditEvent.id,
    eventType,
    timestamp: auditEvent.createdAt
  };
}

/**
 * Log renewal created event
 */
export async function logRenewalCreated(
  renewalId: string,
  privilegeGrantedId: string,
  clinicianDid: string,
  orgId: string,
  dueDate: Date
): Promise<AuditEventResult> {
  return logPrivilegeRenewalEvent(
    'RENEWAL_CREATED',
    {
      renewalId,
      privilegeGrantedId,
      clinicianDid,
      orgId,
      dueDate
    },
    orgId,
    clinicianDid
  );
}

/**
 * Log renewal notification sent
 */
export async function logRenewalNotified(
  renewalId: string,
  privilegeGrantedId: string,
  clinicianDid: string,
  orgId: string,
  notificationsSent: number,
  daysUntilDue: number
): Promise<AuditEventResult> {
  return logPrivilegeRenewalEvent(
    'RENEWAL_NOTIFIED',
    {
      renewalId,
      privilegeGrantedId,
      clinicianDid,
      orgId,
      notificationsSent,
      daysUntilDue,
      notificationType: `D-${daysUntilDue}`
    },
    orgId,
    clinicianDid
  );
}

/**
 * Log renewal completed (approved or denied)
 */
export async function logRenewalCompleted(
  renewalId: string,
  privilegeGrantedId: string,
  clinicianDid: string,
  orgId: string,
  reviewerId: string,
  approved: boolean,
  reason?: string
): Promise<AuditEventResult> {
  return logPrivilegeRenewalEvent(
    approved ? 'RENEWAL_APPROVED' : 'RENEWAL_DENIED',
    {
      renewalId,
      privilegeGrantedId,
      clinicianDid,
      orgId,
      reviewerId,
      approved,
      oldStatus: 'PENDING',
      newStatus: 'COMPLETE',
      reason
    },
    orgId,
    clinicianDid
  );
}

/**
 * Log renewal overdue
 */
export async function logRenewalOverdue(
  renewalId: string,
  privilegeGrantedId: string,
  clinicianDid: string,
  orgId: string,
  dueDate: Date
): Promise<AuditEventResult> {
  return logPrivilegeRenewalEvent(
    'RENEWAL_OVERDUE',
    {
      renewalId,
      privilegeGrantedId,
      clinicianDid,
      orgId,
      dueDate,
      oldStatus: 'PENDING',
      newStatus: 'OVERDUE',
      daysOverdue: Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    },
    orgId,
    clinicianDid
  );
}

/**
 * Log temporary privilege granted
 */
export async function logTemporaryPrivilegeGranted(
  privilegeGrantedId: string,
  clinicianDid: string,
  orgId: string,
  emergencyReason: string,
  durationDays: number
): Promise<AuditEventResult> {
  return logPrivilegeRenewalEvent(
    'TEMPORARY_PRIVILEGE_GRANTED',
    {
      privilegeGrantedId,
      clinicianDid,
      orgId,
      emergencyReason,
      durationDays,
      isTemporary: true
    },
    orgId,
    clinicianDid
  );
}

/**
 * Log temporary privilege expired
 */
export async function logTemporaryPrivilegeExpired(
  privilegeGrantedId: string,
  clinicianDid: string,
  orgId: string
): Promise<AuditEventResult> {
  return logPrivilegeRenewalEvent(
    'TEMPORARY_PRIVILEGE_EXPIRED',
    {
      privilegeGrantedId,
      clinicianDid,
      orgId,
      oldStatus: 'ACTIVE',
      newStatus: 'EXPIRED'
    },
    orgId,
    clinicianDid
  );
}

/**
 * Query audit events for a renewal
 */
export async function getAuditEventsForRenewal(renewalId: string): Promise<any[]> {
  const events = await prisma.auditEvent.findMany({
    where: {
      type: {
        in: [
          'RENEWAL_CREATED',
          'RENEWAL_NOTIFIED',
          'RENEWAL_COMPLETED',
          'RENEWAL_OVERDUE',
          'RENEWAL_APPROVED',
          'RENEWAL_DENIED'
        ]
      },
      data: {
        path: ['renewalId'],
        equals: renewalId
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return events;
}

/**
 * Query audit events for a privilege
 */
export async function getAuditEventsForPrivilege(privilegeGrantedId: string): Promise<any[]> {
  const events = await prisma.auditEvent.findMany({
    where: {
      data: {
        path: ['privilegeGrantedId'],
        equals: privilegeGrantedId
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return events;
}

