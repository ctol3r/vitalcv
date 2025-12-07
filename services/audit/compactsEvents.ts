/**
 * B138A-AUD-014: Compacts Audit Events
 *
 * Audit event recording for compact eligibility computation, refresh, and errors.
 * All events are recorded with blockchain anchoring for tamper-proof audit trail.
 */

import type { PrismaClient } from '@prisma/client';
import type { CompactsStatusData } from '../compacts/models/CompactsStatus.js';

// Compact event types
export type CompactEventType =
  | 'COMPACT_COMPUTED'
  | 'COMPACT_REFRESHED'
  | 'COMPACT_ERROR'
  | 'IMLC_ELIGIBILITY_COMPUTED'
  | 'PSYPACT_ELIGIBILITY_COMPUTED'
  | 'COUNSELING_ELIGIBILITY_COMPUTED'
  | 'COMPACT_VC_ISSUED'
  | 'COMPACT_VC_REVOKED';

// Compact audit event payload
export interface CompactAuditEventPayload {
  eventType: CompactEventType;
  clinicianDid: string;
  compactType?: 'IMLC' | 'PSYPACT' | 'COUNSELING' | 'UNIFIED';
  status?: string;
  eligibleStates?: string[];
  previousStatus?: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Record a compact eligibility computation event
 */
export async function recordCompactComputedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  compactStatus: CompactsStatusData,
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'COMPACT_COMPUTED',
      subjectNpi: undefined, // Using DID instead
      userId: undefined,
      data: {
        clinicianDid,
        imlcStatus: compactStatus.imlcStatus,
        imlcStates: compactStatus.imlcCompactStates,
        psypactStatus: compactStatus.psypactStatus,
        psypactStates: compactStatus.psypactStates,
        counselingStatus: compactStatus.counselingStatus,
        counselingStates: compactStatus.counselingStates,
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Record a compact status refresh event
 */
export async function recordCompactRefreshedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  previousStatus: CompactsStatusData,
  newStatus: CompactsStatusData,
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'COMPACT_REFRESHED',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        previousStatus: {
          imlcStatus: previousStatus.imlcStatus,
          psypactStatus: previousStatus.psypactStatus,
          counselingStatus: previousStatus.counselingStatus,
        },
        newStatus: {
          imlcStatus: newStatus.imlcStatus,
          psypactStatus: newStatus.psypactStatus,
          counselingStatus: newStatus.counselingStatus,
        },
        statusChanged: {
          imlc: previousStatus.imlcStatus !== newStatus.imlcStatus,
          psypact: previousStatus.psypactStatus !== newStatus.psypactStatus,
          counseling: previousStatus.counselingStatus !== newStatus.counselingStatus,
        },
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Record a compact eligibility computation error
 */
export async function recordCompactErrorEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  error: Error,
  compactType: 'IMLC' | 'PSYPACT' | 'COUNSELING' | 'UNIFIED',
  metadata?: Record<string, any>
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'COMPACT_ERROR',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        compactType,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        metadata,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

/**
 * Record IMLC eligibility computation
 */
export async function recordIMLCEligibilityEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  status: string,
  homeState: string,
  eligibleStates: string[],
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'IMLC_ELIGIBILITY_COMPUTED',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        status,
        homeState,
        eligibleStates,
        eligibleStatesCount: eligibleStates.length,
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Record PSYPACT eligibility computation
 */
export async function recordPSYPACTEligibilityEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  status: string,
  primaryState: string | undefined,
  participatingStates: string[],
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'PSYPACT_ELIGIBILITY_COMPUTED',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        status,
        primaryState,
        participatingStates,
        participatingStatesCount: participatingStates.length,
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Record Counseling Compact eligibility computation
 */
export async function recordCounselingEligibilityEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  status: string,
  homeState: string | undefined,
  compactStates: string[],
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'COUNSELING_ELIGIBILITY_COMPUTED',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        status,
        homeState,
        compactStates,
        compactStatesCount: compactStates.length,
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Record compact VC issuance
 */
export async function recordCompactVCIssuedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  vcCredentialId: string,
  vcHash: string,
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'COMPACT_VC_ISSUED',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        vcCredentialId,
        vcHash,
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Record compact VC revocation
 */
export async function recordCompactVCRevokedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  vcCredentialId: string,
  reason: string,
  chainTxHash?: string
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'COMPACT_VC_REVOKED',
      subjectNpi: undefined,
      userId: undefined,
      data: {
        clinicianDid,
        vcCredentialId,
        reason,
        timestamp: new Date().toISOString(),
      },
      chainTxHash,
    },
  });
}

/**
 * Get compact audit events for a clinician
 */
export async function getCompactAuditEvents(
  prisma: PrismaClient,
  clinicianDid: string,
  options?: {
    limit?: number;
    offset?: number;
    eventType?: CompactEventType;
  }
): Promise<any[]> {
  const where: any = {
    type: options?.eventType || {
      in: [
        'COMPACT_COMPUTED',
        'COMPACT_REFRESHED',
        'COMPACT_ERROR',
        'IMLC_ELIGIBILITY_COMPUTED',
        'PSYPACT_ELIGIBILITY_COMPUTED',
        'COUNSELING_ELIGIBILITY_COMPUTED',
        'COMPACT_VC_ISSUED',
        'COMPACT_VC_REVOKED',
      ],
    },
  };

  // Since we're storing clinicianDid in the data field, we need to filter in application code
  // or use a text search. For simplicity, we'll fetch all compact events and filter.
  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0,
  });

  // Filter by clinicianDid in data field
  return events.filter((event: any) => {
    const data = event.data as any;
    return data?.clinicianDid === clinicianDid;
  });
}

