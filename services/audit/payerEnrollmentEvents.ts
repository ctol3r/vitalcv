/**
 * B137A-NCQA-011: PayerEnrollment evidence logging
 *
 * Captures evidence events for NCQA credentialing requirements (CR1-CR5):
 * - CR1: Primary source verification of education, training, licenses
 * - CR2: Verification of board certification
 * - CR3: Verification of work history
 * - CR4: Disclosure of malpractice claims history
 * - CR5: Sanctions and legal actions check (NPDB, LEIE, state licensing boards)
 *
 * All evidence is hashed and can be anchored on-chain for immutability.
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export enum EvidenceEventType {
  CAQH_CHECK = 'caqh_check',
  PECOS_CHECK = 'pecos_check',
  LEIE_CHECK = 'leie_check',
  NPDB_CHECK = 'npdb_check',
  EVIDENCE_SUBMITTED = 'evidence_submitted',
  LICENSE_VERIFICATION = 'license_verification',
  BOARD_CERT_VERIFICATION = 'board_cert_verification',
  EDUCATION_VERIFICATION = 'education_verification',
  WORK_HISTORY_VERIFICATION = 'work_history_verification',
  MALPRACTICE_CHECK = 'malpractice_check',
  STATUS_CHANGE = 'status_change',
}

export enum EvidenceResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
}

export enum EvidenceSource {
  CAQH = 'CAQH',
  PECOS = 'PECOS',
  LEIE = 'LEIE',
  NPDB = 'NPDB',
  STATE_BOARD = 'STATE_BOARD',
  ABMS = 'ABMS', // American Board of Medical Specialties
  PRIMARY_SOURCE = 'PRIMARY_SOURCE',
  SELF_ATTESTATION = 'SELF_ATTESTATION',
  SYSTEM = 'SYSTEM',
}

export interface LogEvidenceEventParams {
  enrollmentId: string;
  eventType: EvidenceEventType;
  source: EvidenceSource;
  result: EvidenceResult;
  evidenceUrl?: string;
  evidenceData?: any; // Will be hashed
  metadata?: any;
  anchoredTxHash?: string;
}

export interface EvidenceEvent {
  id: string;
  enrollmentId: string;
  eventType: string;
  source: string;
  result: string;
  evidenceUrl: string | null;
  evidenceHash: string | null;
  anchoredTxHash: string | null;
  metadata: any;
  createdAt: Date;
}

/**
 * Logs an evidence event for payer enrollment
 *
 * @param params - Event parameters
 * @returns Created event record
 */
export async function logEvidenceEvent(
  params: LogEvidenceEventParams
): Promise<EvidenceEvent> {
  const {
    enrollmentId,
    eventType,
    source,
    result,
    evidenceUrl,
    evidenceData,
    metadata,
    anchoredTxHash,
  } = params;

  // Hash evidence data if provided
  let evidenceHash: string | null = null;
  if (evidenceData) {
    evidenceHash = hashEvidence(evidenceData);
  }

  const event = await prisma.payerEnrollmentEvent.create({
    data: {
      enrollmentId,
      eventType,
      source,
      result,
      evidenceUrl,
      evidenceHash,
      anchoredTxHash,
      metadata: metadata || {},
    },
  });

  return event;
}

/**
 * Logs CAQH profile check
 */
export async function logCaqhCheck(
  enrollmentId: string,
  caqhProfile: any,
  validationResult: { isValid: boolean; reasons: string[] }
): Promise<EvidenceEvent> {
  return logEvidenceEvent({
    enrollmentId,
    eventType: EvidenceEventType.CAQH_CHECK,
    source: EvidenceSource.CAQH,
    result: validationResult.isValid ? EvidenceResult.PASS : EvidenceResult.FAIL,
    evidenceData: caqhProfile,
    metadata: {
      caqhId: caqhProfile.caqhId,
      caqhStatus: caqhProfile.status,
      validationReasons: validationResult.reasons,
      ncqaMapping: 'CR1, CR2, CR3, CR4', // NCQA requirements covered
    },
  });
}

/**
 * Logs PECOS enrollment check
 */
export async function logPecosCheck(
  enrollmentId: string,
  pecosStatus: any,
  validationResult: { isValid: boolean; reasons: string[] }
): Promise<EvidenceEvent> {
  return logEvidenceEvent({
    enrollmentId,
    eventType: EvidenceEventType.PECOS_CHECK,
    source: EvidenceSource.PECOS,
    result: validationResult.isValid ? EvidenceResult.PASS : EvidenceResult.FAIL,
    evidenceData: pecosStatus,
    metadata: {
      pecosEnrollmentId: pecosStatus.pecosEnrollmentId,
      pecosStatus: pecosStatus.status,
      validationReasons: validationResult.reasons,
      ncqaMapping: 'CR1', // Primary source verification
    },
  });
}

/**
 * Logs LEIE (OIG exclusion list) check
 */
export async function logLeieCheck(
  enrollmentId: string,
  npi: string,
  leieResult: { found: boolean; details?: any }
): Promise<EvidenceEvent> {
  return logEvidenceEvent({
    enrollmentId,
    eventType: EvidenceEventType.LEIE_CHECK,
    source: EvidenceSource.LEIE,
    result: leieResult.found ? EvidenceResult.FAIL : EvidenceResult.PASS,
    evidenceData: leieResult.details,
    metadata: {
      npi,
      leieFound: leieResult.found,
      ncqaMapping: 'CR5', // Sanctions check
    },
  });
}

/**
 * Logs NPDB (National Practitioner Data Bank) check
 */
export async function logNpdbCheck(
  enrollmentId: string,
  clinicianDid: string,
  npdbResult: { status: string; adverseActions?: any[] }
): Promise<EvidenceEvent> {
  const hasAdverseActions =
    npdbResult.adverseActions && npdbResult.adverseActions.length > 0;

  return logEvidenceEvent({
    enrollmentId,
    eventType: EvidenceEventType.NPDB_CHECK,
    source: EvidenceSource.NPDB,
    result:
      npdbResult.status === 'CLEAN'
        ? EvidenceResult.PASS
        : hasAdverseActions
          ? EvidenceResult.FAIL
          : EvidenceResult.WARNING,
    evidenceData: npdbResult,
    metadata: {
      clinicianDid,
      npdbStatus: npdbResult.status,
      adverseActionCount: npdbResult.adverseActions?.length || 0,
      ncqaMapping: 'CR5', // Sanctions and legal actions check
    },
  });
}

/**
 * Logs evidence submission (VCs, documents, etc.)
 */
export async function logEvidenceSubmission(
  enrollmentId: string,
  evidenceIds: string[],
  evidenceBundle: any
): Promise<EvidenceEvent> {
  return logEvidenceEvent({
    enrollmentId,
    eventType: EvidenceEventType.EVIDENCE_SUBMITTED,
    source: EvidenceSource.SELF_ATTESTATION,
    result: EvidenceResult.PENDING,
    evidenceData: evidenceBundle,
    metadata: {
      evidenceIds,
      evidenceCount: evidenceIds.length,
      submittedAt: new Date().toISOString(),
    },
  });
}

/**
 * Logs enrollment status change
 */
export async function logStatusChange(
  enrollmentId: string,
  oldStatus: string,
  newStatus: string,
  reason?: string
): Promise<EvidenceEvent> {
  return logEvidenceEvent({
    enrollmentId,
    eventType: EvidenceEventType.STATUS_CHANGE,
    source: EvidenceSource.SYSTEM,
    result: EvidenceResult.PASS,
    metadata: {
      oldStatus,
      newStatus,
      reason,
      changedAt: new Date().toISOString(),
    },
  });
}

/**
 * Gets all evidence events for an enrollment
 *
 * @param enrollmentId - Enrollment ID
 * @returns Array of evidence events
 */
export async function getEnrollmentEvidence(
  enrollmentId: string
): Promise<EvidenceEvent[]> {
  return prisma.payerEnrollmentEvent.findMany({
    where: { enrollmentId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Gets evidence events by type
 *
 * @param enrollmentId - Enrollment ID
 * @param eventType - Event type to filter
 * @returns Filtered evidence events
 */
export async function getEvidenceByType(
  enrollmentId: string,
  eventType: EvidenceEventType
): Promise<EvidenceEvent[]> {
  return prisma.payerEnrollmentEvent.findMany({
    where: {
      enrollmentId,
      eventType,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Generates NCQA-compliant evidence summary
 *
 * @param enrollmentId - Enrollment ID
 * @returns NCQA evidence summary
 */
export async function generateNcqaEvidenceSummary(enrollmentId: string): Promise<{
  enrollmentId: string;
  cr1_primary_source_verification: {
    completed: boolean;
    sources: string[];
    events: number;
  };
  cr2_board_certification: {
    completed: boolean;
    sources: string[];
    events: number;
  };
  cr3_work_history: {
    completed: boolean;
    sources: string[];
    events: number;
  };
  cr4_malpractice: {
    completed: boolean;
    sources: string[];
    events: number;
  };
  cr5_sanctions_check: {
    completed: boolean;
    sources: string[];
    events: number;
  };
  overallCompliance: boolean;
  generatedAt: Date;
}> {
  const allEvents = await getEnrollmentEvidence(enrollmentId);

  // CR1: Primary source verification
  const cr1Events = allEvents.filter((e) =>
    [
      EvidenceEventType.CAQH_CHECK,
      EvidenceEventType.PECOS_CHECK,
      EvidenceEventType.LICENSE_VERIFICATION,
      EvidenceEventType.EDUCATION_VERIFICATION,
    ].includes(e.eventType as EvidenceEventType)
  );

  // CR2: Board certification
  const cr2Events = allEvents.filter((e) =>
    e.eventType === EvidenceEventType.BOARD_CERT_VERIFICATION
  );

  // CR3: Work history
  const cr3Events = allEvents.filter((e) =>
    e.eventType === EvidenceEventType.WORK_HISTORY_VERIFICATION
  );

  // CR4: Malpractice
  const cr4Events = allEvents.filter((e) =>
    e.eventType === EvidenceEventType.MALPRACTICE_CHECK
  );

  // CR5: Sanctions
  const cr5Events = allEvents.filter((e) =>
    [EvidenceEventType.LEIE_CHECK, EvidenceEventType.NPDB_CHECK].includes(
      e.eventType as EvidenceEventType
    )
  );

  const cr1Completed = cr1Events.length > 0 && cr1Events.some((e) => e.result === 'PASS');
  const cr2Completed = cr2Events.length > 0 && cr2Events.some((e) => e.result === 'PASS');
  const cr3Completed = cr3Events.length > 0 && cr3Events.some((e) => e.result === 'PASS');
  const cr4Completed = cr4Events.length > 0 && cr4Events.some((e) => e.result === 'PASS');
  const cr5Completed = cr5Events.length > 0 && cr5Events.some((e) => e.result === 'PASS');

  return {
    enrollmentId,
    cr1_primary_source_verification: {
      completed: cr1Completed,
      sources: [...new Set(cr1Events.map((e) => e.source))],
      events: cr1Events.length,
    },
    cr2_board_certification: {
      completed: cr2Completed,
      sources: [...new Set(cr2Events.map((e) => e.source))],
      events: cr2Events.length,
    },
    cr3_work_history: {
      completed: cr3Completed,
      sources: [...new Set(cr3Events.map((e) => e.source))],
      events: cr3Events.length,
    },
    cr4_malpractice: {
      completed: cr4Completed,
      sources: [...new Set(cr4Events.map((e) => e.source))],
      events: cr4Events.length,
    },
    cr5_sanctions_check: {
      completed: cr5Completed,
      sources: [...new Set(cr5Events.map((e) => e.source))],
      events: cr5Events.length,
    },
    overallCompliance: cr1Completed && cr5Completed, // CR1 and CR5 are minimum required
    generatedAt: new Date(),
  };
}

/**
 * Hashes evidence data for integrity verification
 *
 * @param data - Evidence data to hash
 * @returns SHA-256 hash
 */
function hashEvidence(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Verifies evidence hash integrity
 *
 * @param data - Original evidence data
 * @param hash - Hash to verify against
 * @returns True if hash matches
 */
export function verifyEvidenceHash(data: any, hash: string): boolean {
  const computedHash = hashEvidence(data);
  return computedHash === hash;
}

