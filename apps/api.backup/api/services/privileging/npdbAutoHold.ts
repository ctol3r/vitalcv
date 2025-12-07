const log = getServiceLogger('privileging/npdbAutoHold');
/**
 * B135A-PRIV-005: NPDB Auto-Hold Service
 *
 * Automatically suspends active privileges when new NPDB adverse events are detected
 * Sends notifications and creates audit events
 */

import { PrismaClient } from '@prisma/client';
import { logPrivilegeRenewalEvent } from '../audit/privilegeRenewalEvents';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export interface NPDBAdverseEvent {
  clinicianDid: string;
  npi?: string;
  adverseActionType: string;
  actionDate: Date;
  description: string;
  reportingOrganization?: string;
}

export interface AutoHoldResult {
  clinicianDid: string;
  privilegesAffected: number;
  notificationsSent: string[];
  auditEventIds: string[];
}

/**
 * Main function: Process new NPDB adverse event and suspend privileges
 */
export async function processNPDBAdverseEvent(
  adverseEvent: NPDBAdverseEvent
): Promise<AutoHoldResult> {
  log.info('[NPDBAutoHold] Processing adverse event', {
    clinicianDid: adverseEvent.clinicianDid,
    type: adverseEvent.adverseActionType
  });

  // Find all active privileges for this clinician
  const activePrivileges = await prisma.privilegeGranted.findMany({
    where: {
      clinicianDid: adverseEvent.clinicianDid,
      status: 'ACTIVE'
    },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true
        }
      }
    }
  });

  log.info(`[NPDBAutoHold] Found ${activePrivileges.length} active privileges to hold`);

  const notificationsSent: string[] = [];
  const auditEventIds: string[] = [];

  // Update all active privileges to HOLD status
  for (const privilege of activePrivileges) {
    // Update status to HOLD
    await prisma.privilegeGranted.update({
      where: { id: privilege.id },
      data: {
        status: 'HOLD',
        updatedAt: new Date()
      }
    });

    // Log audit event
    const auditEvent = await logPrivilegeRenewalEvent(
      'PRIVILEGE_AUTO_HOLD_NPDB',
      {
        privilegeGrantedId: privilege.id,
        clinicianDid: adverseEvent.clinicianDid,
        orgId: privilege.orgId,
        reason: `NPDB adverse action: ${adverseEvent.adverseActionType}`,
        adverseEvent: {
          type: adverseEvent.adverseActionType,
          date: adverseEvent.actionDate,
          description: adverseEvent.description
        }
      },
      privilege.orgId,
      adverseEvent.clinicianDid
    );

    auditEventIds.push(auditEvent.id);

    // Send notification to organization
    const notificationResult = await sendOrganizationNotification(
      privilege.orgId,
      adverseEvent.clinicianDid,
      privilege.id,
      adverseEvent
    );

    if (notificationResult.sent) {
      notificationsSent.push(privilege.orgId);
    }

    // Send notification to clinician
    await sendClinicianNotification(
      adverseEvent.clinicianDid,
      privilege.id,
      adverseEvent
    );
  }

  // Record the NPDB check in monitoring table
  await prisma.npdbOigMonitor.create({
    data: {
      clinicianDid: adverseEvent.clinicianDid,
      npi: adverseEvent.npi,
      monitorType: 'NPDB',
      checkDate: new Date(),
      status: 'ADVERSE_ACTION',
      adverseActions: [adverseEvent],
      privilegeAction: 'HOLD',
      notificationSent: true,
      orgIds: [...new Set(activePrivileges.map(p => p.orgId))],
      rawResponse: adverseEvent
    }
  });

  return {
    clinicianDid: adverseEvent.clinicianDid,
    privilegesAffected: activePrivileges.length,
    notificationsSent: [...new Set(notificationsSent)],
    auditEventIds
  };
}

/**
 * Send notification to organization about privilege hold
 */
async function sendOrganizationNotification(
  orgId: string,
  clinicianDid: string,
  privilegeGrantedId: string,
  adverseEvent: NPDBAdverseEvent
): Promise<{ sent: boolean; method: string }> {
  // TODO: Integrate with notification service (email, Slack, PagerDuty, etc.)
  log.warn(`[NPDBAutoHold] NOTIFICATION TO ORG ${orgId}:`, {
    message: `URGENT: Privilege ${privilegeGrantedId} for clinician ${clinicianDid} has been placed on HOLD due to NPDB adverse action`,
    adverseActionType: adverseEvent.adverseActionType,
    actionDate: adverseEvent.actionDate,
    description: adverseEvent.description
  });

  // Mock notification - replace with actual email/alert service
  return { sent: true, method: 'console' };
}

/**
 * Send notification to clinician about privilege hold
 */
async function sendClinicianNotification(
  clinicianDid: string,
  privilegeGrantedId: string,
  adverseEvent: NPDBAdverseEvent
): Promise<void> {
  // TODO: Integrate with clinician notification service
  log.warn(`[NPDBAutoHold] NOTIFICATION TO CLINICIAN ${clinicianDid}:`, {
    message: `Your privilege ${privilegeGrantedId} has been placed on HOLD due to NPDB adverse action`,
    adverseActionType: adverseEvent.adverseActionType,
    actionDate: adverseEvent.actionDate,
    nextSteps: 'Please contact your credentialing office for review'
  });
}

/**
 * Scheduled job to check for new NPDB adverse events
 * Should be called periodically (e.g., daily)
 */
export async function checkForNewNPDBAdverseEvents(): Promise<void> {
  // TODO: Integrate with actual NPDB API
  log.info('[NPDBAutoHold] Checking for new NPDB adverse events...');

  // Mock: Fetch clinicians with active privileges
  const activeClinicians = await prisma.privilegeGranted.findMany({
    where: {
      status: 'ACTIVE'
    },
    select: {
      clinicianDid: true
    },
    distinct: ['clinicianDid']
  });

  log.info(`[NPDBAutoHold] Checking ${activeClinicians.length} clinicians with active privileges`);

  // For each clinician, check NPDB (mock implementation)
  // In production, this would call actual NPDB query service
  for (const { clinicianDid } of activeClinicians) {
    // Mock: Check if there's a new adverse event (would be actual NPDB API call)
    const hasNewAdverseEvent = false; // Replace with actual check

    if (hasNewAdverseEvent) {
      // Process the adverse event
      // const adverseEvent = ... fetch from NPDB
      // await processNPDBAdverseEvent(adverseEvent);
    }
  }
}

