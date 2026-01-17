/**
 * B138A-AUD-014: Compacts Audit Events
 *
 * Audit event recording for compact eligibility computation, refresh, and errors.
 * All events are recorded with blockchain anchoring for tamper-proof audit trail.
 */
import type { CompactsStatusData } from '../compacts/models/CompactsStatus.js';
type PrismaClient = {
  auditEvent: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
  [key: string]: any;
};
export type CompactEventType =
  | 'COMPACT_COMPUTED'
  | 'COMPACT_REFRESHED'
  | 'COMPACT_ERROR'
  | 'IMLC_ELIGIBILITY_COMPUTED'
  | 'PSYPACT_ELIGIBILITY_COMPUTED'
  | 'COUNSELING_ELIGIBILITY_COMPUTED'
  | 'COMPACT_VC_ISSUED'
  | 'COMPACT_VC_REVOKED';
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
export declare function recordCompactComputedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  compactStatus: CompactsStatusData,
  chainTxHash?: string,
): Promise<void>;
/**
 * Record a compact status refresh event
 */
export declare function recordCompactRefreshedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  previousStatus: CompactsStatusData,
  newStatus: CompactsStatusData,
  chainTxHash?: string,
): Promise<void>;
/**
 * Record a compact eligibility computation error
 */
export declare function recordCompactErrorEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  error: Error,
  compactType: 'IMLC' | 'PSYPACT' | 'COUNSELING' | 'UNIFIED',
  metadata?: Record<string, any>,
): Promise<void>;
/**
 * Record IMLC eligibility computation
 */
export declare function recordIMLCEligibilityEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  status: string,
  homeState: string,
  eligibleStates: string[],
  chainTxHash?: string,
): Promise<void>;
/**
 * Record PSYPACT eligibility computation
 */
export declare function recordPSYPACTEligibilityEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  status: string,
  primaryState: string | undefined,
  participatingStates: string[],
  chainTxHash?: string,
): Promise<void>;
/**
 * Record Counseling Compact eligibility computation
 */
export declare function recordCounselingEligibilityEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  status: string,
  homeState: string | undefined,
  compactStates: string[],
  chainTxHash?: string,
): Promise<void>;
/**
 * Record compact VC issuance
 */
export declare function recordCompactVCIssuedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  vcCredentialId: string,
  vcHash: string,
  chainTxHash?: string,
): Promise<void>;
/**
 * Record compact VC revocation
 */
export declare function recordCompactVCRevokedEvent(
  prisma: PrismaClient,
  clinicianDid: string,
  vcCredentialId: string,
  reason: string,
  chainTxHash?: string,
): Promise<void>;
/**
 * Get compact audit events for a clinician
 */
export declare function getCompactAuditEvents(
  prisma: PrismaClient,
  clinicianDid: string,
  options?: {
    limit?: number;
    offset?: number;
    eventType?: CompactEventType;
  },
): Promise<any[]>;
