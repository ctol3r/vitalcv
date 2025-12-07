const log = getServiceLogger('privileging/leieIntegration');
/**
 * B135A-PRIV-006: OIG LEIE Auto-Hold Integration
 *
 * Checks clinicians against OIG List of Excluded Individuals/Entities (LEIE)
 * Triggers privilege HOLD on matches and sends email + PagerDuty alerts
 */

import { PrismaClient } from '@prisma/client';
import { logPrivilegeRenewalEvent } from '../audit/privilegeRenewalEvents';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export interface LEIEMatch {
  clinicianDid: string;
  npi?: string;
  firstName: string;
  lastName: string;
  exclusionType: string;
  exclusionDate: Date;
  waiverDate?: Date;
  waiverState?: string;
  specialty?: string;
}

export interface LEIECheckResult {
  clinicianDid: string;
  isExcluded: boolean;
  matches: LEIEMatch[];
  privilegesAffected: number;
  alertsSent: string[];
}

/**
 * Check a clinician against OIG LEIE database
 */
export async function checkLEIEStatus(
  clinicianDid: string,
  npi?: string,
  firstName?: string,
  lastName?: string
): Promise<LEIECheckResult> {
  log.info('[LEIEIntegration] Checking LEIE status', { clinicianDid, npi });

  // TODO: Integrate with actual OIG LEIE API
  // https://oig.hhs.gov/exclusions/exclusions_list.asp
  const matches = await queryLEIEDatabase(npi, firstName, lastName);

  if (matches.length === 0) {
    // No exclusions found - clinician is clear
    return {
      clinicianDid,
      isExcluded: false,
      matches: [],
      privilegesAffected: 0,
      alertsSent: []
    };
  }

  // Exclusion found - trigger auto-hold
  log.warn('[LEIEIntegration] LEIE MATCH FOUND', {
    clinicianDid,
    npi,
    matchCount: matches.length
  });

  // Process auto-hold for all active privileges
  const holdResult = await processLEIEAutoHold(clinicianDid, matches[0]);

  return {
    clinicianDid,
    isExcluded: true,
    matches,
    privilegesAffected: holdResult.privilegesAffected,
    alertsSent: holdResult.alertsSent
  };
}

/**
 * Process auto-hold for LEIE match
 */
async function processLEIEAutoHold(
  clinicianDid: string,
  leieMatch: LEIEMatch
): Promise<{ privilegesAffected: number; alertsSent: string[] }> {
  // Find all active privileges
  const activePrivileges = await prisma.privilegeGranted.findMany({
    where: {
      clinicianDid,
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

  log.info(`[LEIEIntegration] Placing ${activePrivileges.length} privileges on HOLD`);

  const alertsSent: string[] = [];

  // Update all privileges to HOLD
  for (const privilege of activePrivileges) {
    await prisma.privilegeGranted.update({
      where: { id: privilege.id },
      data: {
        status: 'HOLD',
        updatedAt: new Date()
      }
    });

    // Log audit event
    await logPrivilegeRenewalEvent(
      'PRIVILEGE_AUTO_HOLD_LEIE',
      {
        privilegeGrantedId: privilege.id,
        clinicianDid,
        orgId: privilege.orgId,
        reason: `OIG LEIE exclusion: ${leieMatch.exclusionType}`,
        leieMatch: {
          exclusionType: leieMatch.exclusionType,
          exclusionDate: leieMatch.exclusionDate,
          waiverDate: leieMatch.waiverDate,
          waiverState: leieMatch.waiverState
        }
      },
      privilege.orgId,
      clinicianDid
    );

    // Send alerts
    await sendLEIEAlerts(privilege.orgId, clinicianDid, privilege.id, leieMatch);
    alertsSent.push(privilege.orgId);
  }

  // Record in monitoring table
  await prisma.npdbOigMonitor.create({
    data: {
      clinicianDid,
      npi: leieMatch.npi,
      monitorType: 'OIG',
      checkDate: new Date(),
      status: 'ADVERSE_ACTION',
      adverseActions: [leieMatch],
      privilegeAction: 'HOLD',
      notificationSent: true,
      orgIds: [...new Set(activePrivileges.map(p => p.orgId))],
      rawResponse: leieMatch
    }
  });

  return {
    privilegesAffected: activePrivileges.length,
    alertsSent: [...new Set(alertsSent)]
  };
}

/**
 * Send LEIE alerts (email + PagerDuty)
 */
async function sendLEIEAlerts(
  orgId: string,
  clinicianDid: string,
  privilegeGrantedId: string,
  leieMatch: LEIEMatch
): Promise<void> {
  // 1. Send email alert
  await sendEmailAlert(orgId, clinicianDid, privilegeGrantedId, leieMatch);

  // 2. Send PagerDuty alert (high severity)
  await sendPagerDutyAlert(orgId, clinicianDid, privilegeGrantedId, leieMatch);

  log.warn('[LEIEIntegration] Alerts sent', {
    orgId,
    clinicianDid,
    privilegeGrantedId,
    exclusionType: leieMatch.exclusionType
  });
}

/**
 * Send email alert
 */
async function sendEmailAlert(
  orgId: string,
  clinicianDid: string,
  privilegeGrantedId: string,
  leieMatch: LEIEMatch
): Promise<void> {
  // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
  log.error(`[LEIEIntegration] EMAIL ALERT TO ORG ${orgId}:`, {
    subject: `URGENT: OIG LEIE Exclusion Detected - Privilege ${privilegeGrantedId} on HOLD`,
    body: {
      clinicianDid,
      privilegeGrantedId,
      exclusionType: leieMatch.exclusionType,
      exclusionDate: leieMatch.exclusionDate,
      npi: leieMatch.npi,
      action: 'Privilege automatically placed on HOLD',
      nextSteps: 'Immediate review required. Contact compliance office.'
    }
  });
}

/**
 * Send PagerDuty alert
 */
async function sendPagerDutyAlert(
  orgId: string,
  clinicianDid: string,
  privilegeGrantedId: string,
  leieMatch: LEIEMatch
): Promise<void> {
  // TODO: Integrate with actual PagerDuty Events API v2
  // https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview

  const pagerDutyEvent = {
    routing_key: process.env.PAGERDUTY_INTEGRATION_KEY || 'mock-key',
    event_action: 'trigger',
    payload: {
      summary: `OIG LEIE Exclusion: Privilege ${privilegeGrantedId} on HOLD`,
      severity: 'critical',
      source: 'chai-vc-platform-leie-monitor',
      custom_details: {
        orgId,
        clinicianDid,
        privilegeGrantedId,
        exclusionType: leieMatch.exclusionType,
        exclusionDate: leieMatch.exclusionDate,
        npi: leieMatch.npi
      }
    }
  };

  log.error('[LEIEIntegration] PAGERDUTY ALERT:', pagerDutyEvent);

  // Mock: In production, POST to PagerDuty Events API
  // await fetch('https://events.pagerduty.com/v2/enqueue', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(pagerDutyEvent)
  // });
}

/**
 * Query LEIE database (mock implementation)
 * TODO: Integrate with actual OIG LEIE API or downloadable database
 */
async function queryLEIEDatabase(
  npi?: string,
  firstName?: string,
  lastName?: string
): Promise<LEIEMatch[]> {
  // Mock implementation
  // In production, this would:
  // 1. Query OIG LEIE API or local database
  // 2. Match by NPI, name, DOB, etc.
  // 3. Return any exclusion records

  // For now, return empty (no exclusions)
  return [];
}

/**
 * Scheduled job to check all active clinicians against LEIE
 * Should run daily or weekly
 */
export async function runLEIEBatchCheck(): Promise<void> {
  log.info('[LEIEIntegration] Starting batch LEIE check...');

  // Get all clinicians with active privileges
  const activeClinicians = await prisma.privilegeGranted.findMany({
    where: {
      status: 'ACTIVE'
    },
    select: {
      clinicianDid: true
    },
    distinct: ['clinicianDid']
  });

  log.info(`[LEIEIntegration] Checking ${activeClinicians.length} clinicians`);

  let exclusionsFound = 0;

  for (const { clinicianDid } of activeClinicians) {
    try {
      // TODO: Fetch NPI and name for clinician
      const result = await checkLEIEStatus(clinicianDid);

      if (result.isExcluded) {
        exclusionsFound++;
        log.warn(`[LEIEIntegration] Exclusion found for ${clinicianDid}`);
      }
    } catch (error) {
      log.error(`[LEIEIntegration] Error checking ${clinicianDid}:`, error);
    }
  }

  log.info(`[LEIEIntegration] Batch check complete. Exclusions found: ${exclusionsFound}`);
}

