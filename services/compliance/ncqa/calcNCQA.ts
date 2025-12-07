import { PrismaClient } from '@prisma/client';
import {
  NCQAComplianceStatus,
  NCQAComplianceStatusSchema,
  NCQARuleCode,
  NCQAComplianceRecordInput,
  NCQAEvidenceReference,
  NormalizedNCQAComplianceRecord,
  normalizeNCQAComplianceRecord,
  shouldAlertOnCompliance,
} from '../models/NCQAComplianceRecord';
import { getNCQARuleDefinition } from './ruleRegistry';

const DEFAULT_REVALIDATION_DAYS = 1095;
const PSV_WARN_DAYS = 30;
const dayMs = 24 * 60 * 60 * 1000;

const STATUS_ORDER: NCQAComplianceStatus[] = ['FAIL', 'WARN', 'PENDING', 'PASS'];

export interface NCQAClinicianSnapshot {
  clinicianId: string;
  psv?: {
    status: NCQAComplianceStatus;
    lastVerifiedAt: Date | null;
    nextDueAt: Date | null;
    evidenceId?: string;
    evidenceHash?: string | null;
  };
  licenses: Array<{
    id: string;
    state: string;
    status: string;
    expiresAt: Date | null;
    lastCheckedAt: Date | null;
  }>;
  boardCertifications: Array<{
    id: string;
    board: string;
    expiresAt: Date | null;
    verifiedAt: Date | null;
  }>;
  recredentialing?: {
    lastCompletedAt: Date | null;
    nextDueAt: Date | null;
  };
  rightsAcknowledgements: Array<{
    id: string;
    deliveredAt: Date;
    channel?: string;
  }>;
  fileAudits: Array<{
    id: string;
    completedAt: Date;
    completeness: number;
  }>;
  oppeReports: Array<{
    id: string;
    periodEnd: Date;
    metrics?: Record<string, unknown>;
  }>;
}

export interface CalculateNCQAOptions {
  prisma?: PrismaClient;
  asOf?: Date;
  snapshot?: NCQAClinicianSnapshot;
}

let sharedPrisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!sharedPrisma) {
    sharedPrisma = new PrismaClient();
  }
  return sharedPrisma;
}

export async function calculateNCQAComplianceRecords(
  clinicianId: string,
  options: CalculateNCQAOptions = {}
): Promise<NormalizedNCQAComplianceRecord[]> {
  const prisma = options.prisma ?? getPrisma();
  const asOf = options.asOf ?? new Date();
  const snapshot = options.snapshot ?? (await buildSnapshotForClinician(clinicianId, prisma));
  return evaluateNCQASnapshot(snapshot, asOf);
}

export async function buildSnapshotForClinician(
  clinicianId: string,
  prisma: PrismaClient
): Promise<NCQAClinicianSnapshot> {
  const [psvResult, licenses, events] = await Promise.all([
    prisma.pSVResult.findFirst({
      where: { clinicianId },
      orderBy: { checkedAt: 'desc' },
    }),
    prisma.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.credentialTimelineEvent.findMany({
      where: { clinicianId },
      orderBy: { timestamp: 'desc' },
      take: 250,
    }),
  ]);

  const boardCertifications = events
    .filter((event) => event.eventType === 'BOARD_VERIFIED')
    .map((event) => ({
      id: event.id,
      board: (event.metadata as Record<string, any> | null)?.board ?? 'UNKNOWN',
      expiresAt: toDate((event.metadata as Record<string, any> | null)?.expiresAt),
      verifiedAt: event.timestamp,
    }));

  const rightsAcknowledgements = events
    .filter((event) => event.eventType === 'PRIVILEGE_GRANTED' || event.eventType === 'VC_ISSUED')
    .map((event) => ({
      id: event.id,
      deliveredAt: event.timestamp,
      channel: (event.metadata as Record<string, any> | null)?.channel ?? 'PORTAL',
    }));

  const fileAudits = events
    .filter((event) => event.eventType === 'DISCREPANCY_FOUND')
    .map((event) => ({
      id: event.id,
      completedAt: event.timestamp,
      completeness: Number((event.metadata as Record<string, any> | null)?.completeness ?? 1),
    }));

  const oppeReports = events
    .filter((event) => event.eventType === 'OPPE_CYCLE')
    .map((event) => ({
      id: event.id,
      periodEnd: event.timestamp,
      metrics: (event.metadata as Record<string, any> | null) ?? undefined,
    }));

  const recredentialEvent = events.find((event) => event.eventType === 'REVALIDATION_CREATED');

  return {
    clinicianId,
    psv: psvResult
      ? {
          status: coerceStatus(psvResult.overallStatus),
          lastVerifiedAt: psvResult.checkedAt,
          nextDueAt: psvResult.freshUntil ?? addDays(psvResult.checkedAt, 120),
          evidenceId: psvResult.id,
          evidenceHash: (psvResult.metadata as Record<string, any> | null)?.anchorHash,
        }
      : undefined,
    licenses: licenses.map((license) => ({
      id: license.id,
      state: license.state,
      status: license.status,
      expiresAt: license.expiryDate ?? null,
      lastCheckedAt: license.lastCheckedAt ?? null,
    })),
    boardCertifications,
    recredentialing: recredentialEvent
      ? {
          lastCompletedAt: recredentialEvent.timestamp,
          nextDueAt: addDays(recredentialEvent.timestamp, DEFAULT_REVALIDATION_DAYS),
        }
      : undefined,
    rightsAcknowledgements,
    fileAudits,
    oppeReports,
  };
}

export function evaluateNCQASnapshot(
  snapshot: NCQAClinicianSnapshot,
  asOf: Date = new Date()
): NormalizedNCQAComplianceRecord[] {
  return [
    evaluateCR1(snapshot, asOf),
    evaluateCR2(snapshot, asOf),
    evaluateCR3(snapshot, asOf),
    evaluateCR4(snapshot, asOf),
    evaluateCR5(snapshot, asOf),
  ];
}

function evaluateCR1(snapshot: NCQAClinicianSnapshot, asOf: Date): NormalizedNCQAComplianceRecord {
  const rule = getNCQARuleDefinition('CR1');
  let status: NCQAComplianceStatus = 'PASS';
  const notes: string[] = [];
  const evidenceRefs: NCQAEvidenceReference[] = [];

  if (!snapshot.psv) {
    status = 'PENDING';
    notes.push('No PSV bundle recorded.');
  } else {
    evidenceRefs.push(
      buildEvidenceRef({
        id: snapshot.psv.evidenceId ?? `psv-${snapshot.clinicianId}`,
        type: 'PSV_RESULT',
        label: 'Primary source verification bundle',
        uri: `/psv/results/${snapshot.psv.evidenceId ?? 'latest'}`,
        capturedAt: snapshot.psv.lastVerifiedAt ?? undefined,
        hash: snapshot.psv.evidenceHash ?? undefined,
      })
    );
    if (snapshot.psv.nextDueAt && snapshot.psv.nextDueAt.getTime() < asOf.getTime()) {
      status = 'FAIL';
      notes.push('PSV bundle expired.');
    } else if (
      snapshot.psv.nextDueAt &&
      snapshot.psv.nextDueAt.getTime() - asOf.getTime() <= PSV_WARN_DAYS * dayMs
    ) {
      status = downgradeStatus(status, 'WARN');
      notes.push('PSV bundle will expire within 30 days.');
    }
  }

  const activeLicense = snapshot.licenses.find(
    (license) =>
      ['ACTIVE', 'CURRENT'].includes(license.status.toUpperCase()) &&
      (!license.expiresAt || license.expiresAt.getTime() >= asOf.getTime())
  );
  if (!activeLicense) {
    status = 'FAIL';
    notes.push('No active license on file.');
  } else {
    evidenceRefs.push(
      buildEvidenceRef({
        id: activeLicense.id,
        type: 'LICENSE',
        label: `License ${activeLicense.state}`,
        uri: `/licenses/${activeLicense.id}`,
        capturedAt: activeLicense.lastCheckedAt ?? undefined,
      })
    );
  }

  const activeBoard = snapshot.boardCertifications.find(
    (board) => !board.expiresAt || board.expiresAt.getTime() >= asOf.getTime()
  );
  if (!activeBoard) {
    status = 'FAIL';
    notes.push('Board certification missing or expired.');
  } else {
    evidenceRefs.push(
      buildEvidenceRef({
        id: activeBoard.id,
        type: 'BOARD_CERT',
        label: `Board certification (${activeBoard.board})`,
        uri: `/board-certifications/${activeBoard.id}`,
        capturedAt: activeBoard.verifiedAt ?? undefined,
      })
    );
  }

  const payload: NCQAComplianceRecordInput = {
    clinicianId: snapshot.clinicianId,
    ruleCode: 'CR1',
    status,
    lastVerifiedAt: snapshot.psv?.lastVerifiedAt ?? activeLicense?.lastCheckedAt ?? null,
    nextDueAt: snapshot.psv?.nextDueAt ?? null,
    evidenceRefs,
    notes: notes.join(' '),
    metadata: {
      requiredSources: rule.requiredSources.length,
      licenseCount: snapshot.licenses.length,
      boardCount: snapshot.boardCertifications.length,
    },
  };

  return normalizeNCQAComplianceRecord(payload);
}

function evaluateCR2(snapshot: NCQAClinicianSnapshot, asOf: Date): NormalizedNCQAComplianceRecord {
  const rule = getNCQARuleDefinition('CR2');
  let status: NCQAComplianceStatus = 'PASS';
  const notes: string[] = [];
  const evidenceRefs: NCQAEvidenceReference[] = [];

  if (!snapshot.recredentialing?.lastCompletedAt) {
    status = 'PENDING';
    notes.push('Recredentialing cycle has not been recorded.');
  } else {
    const nextDue = snapshot.recredentialing.nextDueAt ?? addDays(snapshot.recredentialing.lastCompletedAt, DEFAULT_REVALIDATION_DAYS);
    if (nextDue.getTime() < asOf.getTime()) {
      status = 'FAIL';
      notes.push('Recredentialing overdue (>36 months).');
    } else if (nextDue.getTime() - asOf.getTime() <= 90 * dayMs) {
      status = downgradeStatus(status, 'WARN');
      notes.push('Recredentialing due within 90 days.');
    }
    evidenceRefs.push(
      buildEvidenceRef({
        id: `recred-${snapshot.clinicianId}`,
        type: 'PSV_RESULT',
        label: 'Recredentialing workflow',
        uri: `/recredentialing/${snapshot.clinicianId}`,
        capturedAt: snapshot.recredentialing.lastCompletedAt ?? undefined,
      })
    );
  }

  const expiredLicense = snapshot.licenses.find(
    (license) => license.expiresAt && license.expiresAt.getTime() < asOf.getTime()
  );
  if (expiredLicense) {
    status = 'FAIL';
    notes.push(`License ${expiredLicense.state} expired on ${expiredLicense.expiresAt?.toISOString()}.`);
    evidenceRefs.push(
      buildEvidenceRef({
        id: expiredLicense.id,
        type: 'LICENSE',
        label: `Expired license (${expiredLicense.state})`,
        uri: `/licenses/${expiredLicense.id}`,
        capturedAt: expiredLicense.lastCheckedAt ?? undefined,
      })
    );
  }

  const payload: NCQAComplianceRecordInput = {
    clinicianId: snapshot.clinicianId,
    ruleCode: 'CR2',
    status,
    lastVerifiedAt: snapshot.recredentialing?.lastCompletedAt ?? null,
    nextDueAt: snapshot.recredentialing?.nextDueAt ?? null,
    evidenceRefs,
    notes: notes.join(' '),
    metadata: { windowDays: rule.refreshWindowDays },
  };

  return normalizeNCQAComplianceRecord(payload);
}

function evaluateCR3(snapshot: NCQAClinicianSnapshot, asOf: Date): NormalizedNCQAComplianceRecord {
  const rule = getNCQARuleDefinition('CR3');
  let status: NCQAComplianceStatus = 'PASS';
  const notes: string[] = [];
  const evidenceRefs: NCQAEvidenceReference[] = [];

  if (snapshot.rightsAcknowledgements.length === 0) {
    status = 'PENDING';
    notes.push('No practitioner rights acknowledgement recorded.');
  } else {
    const latest = snapshot.rightsAcknowledgements[0];
    evidenceRefs.push(
      buildEvidenceRef({
        id: latest.id,
        type: 'RIGHTS_NOTICE',
        label: 'Practitioner rights acknowledgement',
        uri: `/rights/${latest.id}`,
        capturedAt: latest.deliveredAt,
      })
    );
    if (asOf.getTime() - latest.deliveredAt.getTime() > rule.refreshWindowDays * dayMs) {
      status = 'WARN';
      notes.push('Rights acknowledgement older than policy window.');
    }
  }

  const payload: NCQAComplianceRecordInput = {
    clinicianId: snapshot.clinicianId,
    ruleCode: 'CR3',
    status,
    lastVerifiedAt: snapshot.rightsAcknowledgements[0]?.deliveredAt ?? null,
    nextDueAt: snapshot.rightsAcknowledgements[0]
      ? addDays(snapshot.rightsAcknowledgements[0].deliveredAt, rule.refreshWindowDays)
      : null,
    evidenceRefs,
    notes: notes.join(' '),
  };

  return normalizeNCQAComplianceRecord(payload);
}

function evaluateCR4(snapshot: NCQAClinicianSnapshot, asOf: Date): NormalizedNCQAComplianceRecord {
  const rule = getNCQARuleDefinition('CR4');
  let status: NCQAComplianceStatus = 'PENDING';
  const notes: string[] = [];
  const evidenceRefs: NCQAEvidenceReference[] = [];

  if (snapshot.fileAudits.length > 0) {
    status = 'PASS';
    const latest = snapshot.fileAudits[0];
    evidenceRefs.push(
      buildEvidenceRef({
        id: latest.id,
        type: 'FILE_AUDIT',
        label: 'File completeness audit',
        uri: `/audits/${latest.id}`,
        capturedAt: latest.completedAt,
        metadata: { completeness: latest.completeness },
      })
    );
    if (latest.completeness < 0.95) {
      status = 'FAIL';
      notes.push(`File completeness ${Math.round(latest.completeness * 100)}% < 95%.`);
    } else if (asOf.getTime() - latest.completedAt.getTime() > rule.refreshWindowDays * dayMs) {
      status = 'WARN';
      notes.push('Delegation audit older than 12 months.');
    }
  } else {
    notes.push('No delegation/file audit evidence available.');
  }

  const payload: NCQAComplianceRecordInput = {
    clinicianId: snapshot.clinicianId,
    ruleCode: 'CR4',
    status,
    lastVerifiedAt: snapshot.fileAudits[0]?.completedAt ?? null,
    nextDueAt: snapshot.fileAudits[0]
      ? addDays(snapshot.fileAudits[0].completedAt, rule.refreshWindowDays)
      : null,
    evidenceRefs,
    notes: notes.join(' '),
  };

  return normalizeNCQAComplianceRecord(payload);
}

function evaluateCR5(snapshot: NCQAClinicianSnapshot, asOf: Date): NormalizedNCQAComplianceRecord {
  const rule = getNCQARuleDefinition('CR5');
  let status: NCQAComplianceStatus = 'PENDING';
  const notes: string[] = [];
  const evidenceRefs: NCQAEvidenceReference[] = [];

  if (snapshot.oppeReports.length > 0) {
    status = 'PASS';
    const latest = snapshot.oppeReports[0];
    evidenceRefs.push(
      buildEvidenceRef({
        id: latest.id,
        type: 'OPPE',
        label: 'OPPE metrics snapshot',
        uri: `/oppe/${latest.id}`,
        capturedAt: latest.periodEnd,
        metadata: latest.metrics,
      })
    );
    if (asOf.getTime() - latest.periodEnd.getTime() > rule.refreshWindowDays * dayMs) {
      status = 'WARN';
      notes.push('OPPE report older than 6 months.');
    }
  } else {
    notes.push('No OPPE evidence captured.');
  }

  const payload: NCQAComplianceRecordInput = {
    clinicianId: snapshot.clinicianId,
    ruleCode: 'CR5',
    status,
    lastVerifiedAt: snapshot.oppeReports[0]?.periodEnd ?? null,
    nextDueAt: snapshot.oppeReports[0]
      ? addDays(snapshot.oppeReports[0].periodEnd, rule.refreshWindowDays)
      : null,
    evidenceRefs,
    notes: notes.join(' '),
  };

  return normalizeNCQAComplianceRecord(payload);
}

function buildEvidenceRef(input: {
  id: string;
  type: NCQAEvidenceReference['type'];
  label: string;
  uri: string;
  capturedAt?: Date;
  hash?: string;
  metadata?: Record<string, unknown>;
}): NCQAEvidenceReference {
  return {
    id: input.id,
    type: input.type,
    label: input.label,
    uri: input.uri,
    capturedAt: input.capturedAt,
    hash: input.hash,
    metadata: input.metadata,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function coerceStatus(value: string | null): NCQAComplianceStatus {
  const parsed = NCQAComplianceStatusSchema.safeParse(value ?? 'PENDING');
  return parsed.success ? parsed.data : 'PENDING';
}

function downgradeStatus(current: NCQAComplianceStatus, next: NCQAComplianceStatus): NCQAComplianceStatus {
  return STATUS_ORDER[Math.min(STATUS_ORDER.indexOf(current), STATUS_ORDER.indexOf(next))] ?? current;
}

export function summarizeCompliance(records: NormalizedNCQAComplianceRecord[]) {
  return records.reduce(
    (acc, record) => {
      acc.counts[record.status] = (acc.counts[record.status] ?? 0) + 1;
      if (shouldAlertOnCompliance(record)) {
        acc.alerts.push(record.ruleCode);
      }
      return acc;
    },
    {
      counts: {} as Record<NCQAComplianceStatus, number>,
      alerts: [] as NCQARuleCode[],
    }
  );
}
