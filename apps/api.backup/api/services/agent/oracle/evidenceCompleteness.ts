import { CredentialAgentTaskType, PrismaClient } from '@prisma/client';
import { CREDENTIAL_AGENT_TASK_TYPES } from '../models/CredentialAgentTask.js';

const prisma = new PrismaClient();

export type EvidenceStatus = 'COMPLETE' | 'MISSING' | 'STALE' | 'FAILED';
export type EvidenceSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface EvidenceGap {
  taskType: CredentialAgentTaskType;
  status: EvidenceStatus;
  severity: EvidenceSeverity;
  reason: string;
  lastCheckedAt?: Date | null;
  payloadHints?: Record<string, unknown>;
}

export interface NarrativeGapFinding {
  title: string;
  description: string;
  recommendedTask: CredentialAgentTaskType;
  confidence: number;
}

export interface EvidenceAssessment {
  clinicianId: string;
  clinicianDid?: string;
  clinicianNpi?: string;
  results: Record<CredentialAgentTaskType, EvidenceGap>;
  narrativeFindings: NarrativeGapFinding[];
}

export interface EvidenceCompletenessOptions {
  prismaClient?: PrismaClient;
  deterministicNarrative?: boolean;
  narrativeAnalyzer?: NarrativeGapAnalyzer;
}

interface NarrativeGapContext {
  clinician: Awaited<ReturnType<typeof fetchClinicianProfile>>;
  results: Record<CredentialAgentTaskType, EvidenceGap>;
}

type NarrativeGapAnalyzer = (
  context: NarrativeGapContext
) => Promise<NarrativeGapFinding[]>;

const MAX_LICENSE_STALENESS_DAYS = 30;
const NPDB_STALENESS_DAYS = 90;
const PECOS_STALENESS_DAYS = 120;
const PAYER_RECHECK_DAYS = 90;
const TIMELINE_REFRESH_DAYS = 7;
const COMPLIANCE_REFRESH_DAYS = 7;

export async function evaluateEvidenceCompleteness(
  clinicianId: string,
  options: EvidenceCompletenessOptions = {}
): Promise<EvidenceAssessment> {
  const client = options.prismaClient ?? prisma;
  const clinician = await fetchClinicianProfile(client, clinicianId);

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const clinicianDid = clinician.user?.did ?? undefined;
  const results: Partial<Record<CredentialAgentTaskType, EvidenceGap>> = {};

  results.LICENSE_CHECK = await assessLicenseFreshness(client, clinician);
  results.BOARD_CHECK = await assessBoardCertification(client, clinician);
  results.DEA_CHECK = await assessDeaCredential(client, clinician);
  results.NPDB_QUERY = await assessNpdbFreshness(client, clinicianDid);
  results.PECOS_CHECK = await assessPecosEnrollment(client, clinician);
  results.MEDICAID_CHECK = await assessMedicaidEnrollment(client, clinicianDid);
  results.PAYER_CHECK = await assessPayerEnrollment(client, clinicianDid);
  const privilegeContext = await assessPrivilegeValidation(client, clinicianDid);
  results.PRIVILEGE_VALIDATION = privilegeContext.gap;
  results.OPPE_REFRESH = await assessOppeStatus(client, clinicianDid, privilegeContext.hasPrivileges);
  results.FPPE_EVAL = await assessFppeStatus(client, clinicianDid, privilegeContext.hasPrivileges);
  results.TIMELINE_REFRESH = await assessTimelineFreshness(client, clinicianId);
  results.COMPLIANCE_CALC = await assessComplianceRisk(client, clinicianId);

  // Ensure every task has a result even if not explicitly evaluated above.
  for (const taskType of CREDENTIAL_AGENT_TASK_TYPES) {
    if (!results[taskType]) {
      results[taskType] = {
        taskType,
        status: 'COMPLETE',
        severity: 'LOW',
        reason: 'No outstanding requirements detected',
      };
    }
  }

  const finalizedResults = results as Record<CredentialAgentTaskType, EvidenceGap>;

  const narrativeFindings = await detectNarrativeGaps(
    { clinician, results: finalizedResults },
    options
  );

  return {
    clinicianId,
    clinicianDid,
    clinicianNpi: clinician.npi,
    results: finalizedResults,
    narrativeFindings,
  };
}

async function fetchClinicianProfile(client: PrismaClient, clinicianId: string) {
  return client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });
}

async function assessLicenseFreshness(client: PrismaClient, clinician: { id: string; state: string; npi: string }) {
  const record = await client.stateLicenseVerification.findFirst({
    where: { clinicianId: clinician.id },
    orderBy: { lastCheckedAt: 'desc' },
  });

  if (!record) {
    return buildGap('LICENSE_CHECK', 'MISSING', 'HIGH', 'No state license verification on file', {
      state: clinician.state,
      npi: clinician.npi,
    });
  }

  if (record.status !== 'ACTIVE') {
    return buildGap(
      'LICENSE_CHECK',
      'FAILED',
      'HIGH',
      `Latest state board verification returned status ${record.status}`,
      {
        state: record.state,
        licenseNumber: record.licenseNumber,
      },
      record.lastCheckedAt
    );
  }

  const daysOld = daysBetween(record.lastCheckedAt ?? record.updatedAt ?? new Date(0));
  if (daysOld > MAX_LICENSE_STALENESS_DAYS) {
    return buildGap(
      'LICENSE_CHECK',
      'STALE',
      'MEDIUM',
      `License verification is ${daysOld} days old (max ${MAX_LICENSE_STALENESS_DAYS})`,
      {
        state: record.state,
        licenseNumber: record.licenseNumber,
      },
      record.lastCheckedAt
    );
  }

  return buildGap(
    'LICENSE_CHECK',
    'COMPLETE',
    'LOW',
    `Active license verified ${daysOld} days ago`,
    {
      state: record.state,
      licenseNumber: record.licenseNumber,
    },
    record.lastCheckedAt
  );
}

async function assessBoardCertification(client: PrismaClient, clinician: { userId: string }) {
  const credential = await client.credential.findFirst({
    where: {
      userId: clinician.userId,
      type: { contains: 'Board', mode: 'insensitive' },
    },
    orderBy: { issuedAt: 'desc' },
  });

  if (!credential) {
    return buildGap('BOARD_CHECK', 'MISSING', 'MEDIUM', 'No board certification credentials found');
  }

  if (credential.expiresAt && credential.expiresAt < new Date()) {
    return buildGap('BOARD_CHECK', 'FAILED', 'HIGH', 'Primary board certification is expired', {
      credentialId: credential.id,
    });
  }

  return buildGap('BOARD_CHECK', 'COMPLETE', 'LOW', 'Board certification evidence current', {
    credentialId: credential.id,
  });
}

async function assessDeaCredential(client: PrismaClient, clinician: { userId: string }) {
  const credential = await client.credential.findFirst({
    where: {
      userId: clinician.userId,
      type: 'DEARegistration',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential) {
    return buildGap('DEA_CHECK', 'MISSING', 'MEDIUM', 'No DEA registration credential available');
  }

  if (credential.expiresAt && credential.expiresAt < new Date()) {
    return buildGap('DEA_CHECK', 'FAILED', 'HIGH', 'DEA registration is expired', {
      credentialId: credential.id,
    });
  }

  return buildGap('DEA_CHECK', 'COMPLETE', 'LOW', 'DEA registration appears current', {
    credentialId: credential.id,
  });
}

async function assessNpdbFreshness(client: PrismaClient, clinicianDid?: string) {
  if (!clinicianDid) {
    return buildGap(
      'NPDB_QUERY',
      'MISSING',
      'HIGH',
      'Clinician DID not linked, cannot associate NPDB monitor entries'
    );
  }

  const monitor = await client.npdbOigMonitor.findFirst({
    where: { clinicianDid, monitorType: 'NPDB' },
    orderBy: { checkDate: 'desc' },
  });

  if (!monitor) {
    return buildGap('NPDB_QUERY', 'MISSING', 'HIGH', 'No NPDB query recorded for this clinician');
  }

  if (monitor.status === 'ADVERSE_ACTION') {
    return buildGap(
      'NPDB_QUERY',
      'FAILED',
      'HIGH',
      'NPDB monitor indicates adverse action',
      { monitorId: monitor.id },
      monitor.checkDate
    );
  }

  const daysOld = daysBetween(monitor.checkDate);
  if (daysOld > NPDB_STALENESS_DAYS) {
    return buildGap(
      'NPDB_QUERY',
      'STALE',
      'MEDIUM',
      `NPDB monitor is ${daysOld} days old (max ${NPDB_STALENESS_DAYS})`,
      { monitorId: monitor.id },
      monitor.checkDate
    );
  }

  return buildGap(
    'NPDB_QUERY',
    'COMPLETE',
    'LOW',
    `NPDB monitor clear (${daysOld} days old)`,
    { monitorId: monitor.id },
    monitor.checkDate
  );
}

async function assessPecosEnrollment(client: PrismaClient, clinician: { id: string }) {
  const provider = await client.pECOSProvider.findFirst({
    where: { clinicianId: clinician.id },
    orderBy: { updatedAt: 'desc' },
  });

  if (!provider) {
    return buildGap('PECOS_CHECK', 'MISSING', 'MEDIUM', 'No PECOS enrollment record');
  }

  if (provider.status !== 'ENROLLED') {
    return buildGap(
      'PECOS_CHECK',
      'FAILED',
      'HIGH',
      `PECOS status ${provider.status}`,
      { enrollmentType: provider.enrollmentType }
    );
  }

  const daysOld = provider.lastCheckedAt ? daysBetween(provider.lastCheckedAt) : undefined;
  if (daysOld !== undefined && daysOld > PECOS_STALENESS_DAYS) {
    return buildGap(
      'PECOS_CHECK',
      'STALE',
      'MEDIUM',
      `PECOS status last refreshed ${daysOld} days ago`,
      { revalidationDate: provider.revalidationDate },
      provider.lastCheckedAt ?? undefined
    );
  }

  return buildGap('PECOS_CHECK', 'COMPLETE', 'LOW', 'PECOS enrollment is active', {
    revalidationDate: provider.revalidationDate,
  });
}

async function assessMedicaidEnrollment(client: PrismaClient, clinicianDid?: string) {
  if (!clinicianDid) {
    return buildGap('MEDICAID_CHECK', 'MISSING', 'MEDIUM', 'Clinician DID missing for payer lookups');
  }

  const enrollment = await client.payerEnrollment.findFirst({
    where: {
      clinicianDid,
      status: 'APPROVED',
      payer: {
        planTypes: {
          has: 'Medicaid',
        },
      },
    },
    include: { payer: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!enrollment) {
    return buildGap('MEDICAID_CHECK', 'MISSING', 'MEDIUM', 'No Medicaid enrollment approved');
  }

  const daysOld = enrollment.lastCheckedAt ? daysBetween(enrollment.lastCheckedAt) : undefined;
  if (daysOld && daysOld > PAYER_RECHECK_DAYS) {
    return buildGap(
      'MEDICAID_CHECK',
      'STALE',
      'MEDIUM',
      `Medicaid enrollment last confirmed ${daysOld} days ago`,
      { enrollmentId: enrollment.id },
      enrollment.lastCheckedAt ?? undefined
    );
  }

  return buildGap('MEDICAID_CHECK', 'COMPLETE', 'LOW', 'Medicaid enrollment in good standing', {
    enrollmentId: enrollment.id,
    payer: enrollment.payer?.name,
  });
}

async function assessPayerEnrollment(client: PrismaClient, clinicianDid?: string) {
  if (!clinicianDid) {
    return buildGap('PAYER_CHECK', 'MISSING', 'MEDIUM', 'Clinician DID missing for payer lookups');
  }

  const enrollment = await client.payerEnrollment.findFirst({
    where: {
      clinicianDid,
      status: { in: ['SUBMITTED', 'APPROVED'] },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!enrollment) {
    return buildGap('PAYER_CHECK', 'MISSING', 'MEDIUM', 'No recent payer enrollments on file');
  }

  if (enrollment.status !== 'APPROVED') {
    return buildGap(
      'PAYER_CHECK',
      'STALE',
      'MEDIUM',
      `Most recent payer enrollment is ${enrollment.status.toLowerCase()}`,
      { enrollmentId: enrollment.id }
    );
  }

  if (enrollment.revalidationDueAt && enrollment.revalidationDueAt < new Date()) {
    return buildGap(
      'PAYER_CHECK',
      'FAILED',
      'HIGH',
      'Payer revalidation deadline has passed',
      { enrollmentId: enrollment.id, revalidationDueAt: enrollment.revalidationDueAt }
    );
  }

  return buildGap('PAYER_CHECK', 'COMPLETE', 'LOW', 'At least one payer enrollment approved', {
    enrollmentId: enrollment.id,
    revalidationDueAt: enrollment.revalidationDueAt,
  });
}

async function assessPrivilegeValidation(client: PrismaClient, clinicianDid?: string) {
  if (!clinicianDid) {
    return {
      hasPrivileges: false,
      gap: buildGap(
        'PRIVILEGE_VALIDATION',
        'MISSING',
        'MEDIUM',
        'Clinician DID missing for privilege records'
      ),
    };
  }

  const privileges = await client.privilegeGranted.findMany({
    where: {
      clinicianDid,
      status: { in: ['ACTIVE', 'HOLD'] },
    },
    orderBy: { renewalDue: 'asc' },
  });

  if (privileges.length === 0) {
    return {
      hasPrivileges: false,
      gap: buildGap(
        'PRIVILEGE_VALIDATION',
        'COMPLETE',
        'LOW',
        'No active privileges requiring validation'
      ),
    };
  }

  const overdue = privileges.filter(
    (record) => record.renewalDue && record.renewalDue < new Date()
  );
  if (overdue.length > 0) {
    return {
      hasPrivileges: true,
      gap: buildGap(
        'PRIVILEGE_VALIDATION',
        'FAILED',
        'HIGH',
        'At least one privilege is past due for renewal',
        { privilegeIds: overdue.map((p) => p.id) }
      ),
    };
  }

  const upcoming = privileges.filter((record) => {
    if (!record.renewalDue) return false;
    return record.renewalDue.getTime() - Date.now() < 45 * 24 * 60 * 60 * 1000;
  });

  if (upcoming.length > 0) {
    return {
      hasPrivileges: true,
      gap: buildGap(
        'PRIVILEGE_VALIDATION',
        'STALE',
        'MEDIUM',
        'Privilege renewals approaching within 45 days',
        { privilegeIds: upcoming.map((p) => p.id) }
      ),
    };
  }

  return {
    hasPrivileges: true,
    gap: buildGap(
      'PRIVILEGE_VALIDATION',
      'COMPLETE',
      'LOW',
      'All active privileges are within renewal thresholds',
      { privilegeIds: privileges.map((p) => p.id) }
    ),
  };
}

async function assessOppeStatus(
  client: PrismaClient,
  clinicianDid: string | undefined,
  hasPrivileges: boolean
) {
  if (!hasPrivileges) {
    return buildGap('OPPE_REFRESH', 'COMPLETE', 'LOW', 'OPPE not required without privileges');
  }
  if (!clinicianDid) {
    return buildGap('OPPE_REFRESH', 'MISSING', 'MEDIUM', 'Clinician DID missing for OPPE records');
  }

  const oppe = await client.fppeOppe.findFirst({
    where: { clinicianDid },
    orderBy: { updatedAt: 'desc' },
  });

  if (!oppe) {
    return buildGap('OPPE_REFRESH', 'MISSING', 'MEDIUM', 'No OPPE record associated with privileges');
  }

  if (oppe.oppeNextReviewDue && oppe.oppeNextReviewDue < new Date()) {
    return buildGap(
      'OPPE_REFRESH',
      'STALE',
      'MEDIUM',
      'OPPE review is past due',
      { oppeId: oppe.id },
      oppe.oppeNextReviewDue
    );
  }

  return buildGap('OPPE_REFRESH', 'COMPLETE', 'LOW', 'OPPE cycle current', { oppeId: oppe.id });
}

async function assessFppeStatus(
  client: PrismaClient,
  clinicianDid: string | undefined,
  hasPrivileges: boolean
) {
  if (!hasPrivileges) {
    return buildGap('FPPE_EVAL', 'COMPLETE', 'LOW', 'FPPE not required without privileges');
  }
  if (!clinicianDid) {
    return buildGap('FPPE_EVAL', 'MISSING', 'MEDIUM', 'Clinician DID missing for FPPE records');
  }

  const fppe = await client.fppeOppe.findFirst({
    where: { clinicianDid },
    orderBy: { updatedAt: 'desc' },
  });

  if (!fppe) {
    return buildGap('FPPE_EVAL', 'MISSING', 'MEDIUM', 'No FPPE record for active privileges');
  }

  if (fppe.fppeStatus !== 'COMPLETED') {
    return buildGap(
      'FPPE_EVAL',
      'STALE',
      'MEDIUM',
      `FPPE status ${fppe.fppeStatus}`,
      { fppeId: fppe.id }
    );
  }

  return buildGap('FPPE_EVAL', 'COMPLETE', 'LOW', 'FPPE evaluation completed', { fppeId: fppe.id });
}

async function assessTimelineFreshness(client: PrismaClient, clinicianId: string) {
  const event = await client.credentialTimelineEvent.findFirst({
    where: { clinicianId },
    orderBy: { timestamp: 'desc' },
  });

  if (!event) {
    return buildGap('TIMELINE_REFRESH', 'MISSING', 'LOW', 'No timeline events recorded for clinician');
  }

  const daysOld = daysBetween(event.timestamp);
  if (daysOld > TIMELINE_REFRESH_DAYS) {
    return buildGap(
      'TIMELINE_REFRESH',
      'STALE',
      'LOW',
      `Latest credential timeline event is ${daysOld} days old`,
      { eventType: event.eventType },
      event.timestamp
    );
  }

  return buildGap(
    'TIMELINE_REFRESH',
    'COMPLETE',
    'LOW',
    'Timeline refreshed recently',
    { eventType: event.eventType },
    event.timestamp
  );
}

async function assessComplianceRisk(client: PrismaClient, clinicianId: string) {
  const risk = await client.credentialRisk.findUnique({ where: { clinicianId } });

  if (!risk) {
    return buildGap('COMPLIANCE_CALC', 'MISSING', 'MEDIUM', 'No credential risk calculation recorded');
  }

  const daysOld = daysBetween(risk.updatedAt);
  if (daysOld > COMPLIANCE_REFRESH_DAYS) {
    return buildGap(
      'COMPLIANCE_CALC',
      'STALE',
      'MEDIUM',
      `Credential risk score is ${daysOld} days old`,
      { score: risk.score },
      risk.updatedAt
    );
  }

  return buildGap('COMPLIANCE_CALC', 'COMPLETE', 'LOW', 'Compliance score recently refreshed', {
    score: risk.score,
  });
}

async function detectNarrativeGaps(
  context: NarrativeGapContext,
  options: EvidenceCompletenessOptions
): Promise<NarrativeGapFinding[]> {
  if (options.narrativeAnalyzer) {
    return options.narrativeAnalyzer(context);
  }

  return deterministicNarrativeHeuristic(context);
}

function deterministicNarrativeHeuristic(context: NarrativeGapContext): NarrativeGapFinding[] {
  const highSeverityGaps = Object.values(context.results).filter(
    (gap) => gap.severity === 'HIGH' && gap.status !== 'COMPLETE'
  );

  if (highSeverityGaps.length >= 2) {
    return [
      {
        title: 'Clustered high-severity evidence gaps',
        description: `Detected ${highSeverityGaps.length} high-severity gaps (${highSeverityGaps
          .map((gap) => gap.taskType)
          .join(', ')}). Recommend refreshed compliance scoring.`,
        recommendedTask: 'COMPLIANCE_CALC',
        confidence: 0.78,
      },
    ];
  }

  const staleTimeline = context.results.TIMELINE_REFRESH;
  if (staleTimeline && staleTimeline.status !== 'COMPLETE') {
    return [
      {
        title: 'Timeline refresh overdue',
        description: staleTimeline.reason,
        recommendedTask: 'TIMELINE_REFRESH',
        confidence: 0.66,
      },
    ];
  }

  return [];
}

function buildGap(
  taskType: CredentialAgentTaskType,
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  reason: string,
  payloadHints?: Record<string, unknown>,
  lastCheckedAt?: Date | null
): EvidenceGap {
  return {
    taskType,
    status,
    severity,
    reason,
    payloadHints,
    lastCheckedAt,
  };
}

function daysBetween(input: Date): number {
  const now = Date.now();
  return Math.floor((now - input.getTime()) / (1000 * 60 * 60 * 24));
}

