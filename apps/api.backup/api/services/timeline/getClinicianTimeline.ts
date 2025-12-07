import {
  ClinicianProfile,
  Prisma,
  PrismaClient,
  User,
  LicenseVerificationStatus,
  RevalidationTaskStatus,
} from '@prisma/client';
import { aggregateTimelinePhases } from './aggregatePhases';
import {
  SortDirection,
  TimelineEvent,
  TimelinePhaseGroup,
  TimelineEventStatus,
} from './types';

const prisma = new PrismaClient();

export type ClinicianWithUser = ClinicianProfile & {
  user: Pick<User, 'id' | 'did' | 'roles' | 'name'>;
};

const IDENTITY_EVENT_TITLES: Record<string, string> = {
  CLAIM_L1_OK: 'Identity proof - Level 1 (email OTP)',
  CLAIM_L2_OK: 'Identity proof - Level 2 (document + liveness)',
  CLAIM_L3_REQUESTED: 'Level 3 issuer attestation requested',
  CLAIM_L3_OK: 'Identity proof - Level 3 (issuer attested)',
};

const LICENSE_STATUS_TO_TIMELINE: Record<LicenseVerificationStatus, TimelineEventStatus> = {
  ACTIVE: 'completed',
  INACTIVE: 'warning',
  EXPIRED: 'failed',
  SUSPENDED: 'failed',
  REVOKED: 'failed',
};

const NPDB_EVENT_TYPES = new Set(['npdb_check', 'leie_check']);

export interface TimelineBuildOptions {
  clinician: ClinicianWithUser;
  startDate?: Date;
  endDate?: Date;
  sortDirection?: SortDirection;
}

export interface TimelineBuildResult {
  events: TimelineEvent[];
  phaseGroups: TimelinePhaseGroup[];
}

export interface TimelineSummary {
  clinicianId: string;
  npi: string;
  lastLicenseCheck?: {
    state?: string;
    status?: string;
    checkedAt: string;
    source: 'state_license' | 'psv_license';
  };
  nextRevalidation?: {
    dueAt: string;
    source: 'revalidation_task' | 'payer_enrollment' | 'pecos';
    referenceId?: string;
    category?: string;
  };
  fppeStatus?: {
    status: string;
    startedAt?: string;
    updatedAt?: string;
    notes?: string;
  };
  oppeCycles?: {
    status?: string;
    nextReviewDue?: string;
    lastReviewedAt?: string;
  };
  compactEligibility?: {
    activeCompacts: number;
    lastUpdated?: string;
    compacts: Array<{ type: string; homeState: string; expiresAt?: string }>;
  };
}

export async function loadClinicianWithUser(clinicianId: string): Promise<ClinicianWithUser | null> {
  return prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: {
        select: { id: true, did: true, roles: true, name: true },
      },
    },
  });
}

export async function buildClinicianTimeline(options: TimelineBuildOptions): Promise<TimelineBuildResult> {
  const { clinician, startDate, endDate, sortDirection = 'desc' } = options;

  const [
    identityEvents,
    licenseEvents,
    boardEvents,
    deaEvents,
    enrollmentEvents,
    privilegingEvents,
    qualityEvents,
    ehrSyncEvents,
  ] = await Promise.all([
    fetchIdentityEvents(clinician),
    fetchLicenseEvents(clinician),
    fetchBoardCredentialEvents(clinician),
    fetchDeaCredentialEvents(clinician),
    fetchEnrollmentEvents(clinician),
    fetchPrivilegingEvents(clinician),
    fetchQualityEvents(clinician),
    fetchEhrSyncEvents(clinician),
  ]);

  const combined = [
    ...identityEvents,
    ...licenseEvents,
    ...boardEvents,
    ...deaEvents,
    ...enrollmentEvents,
    ...privilegingEvents,
    ...qualityEvents,
    ...ehrSyncEvents,
  ];

  const filtered = combined.filter((event) => withinRange(event.timestamp, startDate, endDate));

  filtered.sort((a, b) => {
    const delta = a.timestamp.getTime() - b.timestamp.getTime();
    return sortDirection === 'asc' ? delta : -delta;
  });

  return {
    events: filtered,
    phaseGroups: aggregateTimelinePhases(filtered, {
      sortDirection,
      includeEmptyPhases: false,
    }),
  };
}

export async function getTimelineSummary(clinician: ClinicianWithUser): Promise<TimelineSummary> {
  const [lastLicenseCheck, nextReval, fppeSummary, oppeSummary, compactSummary] = await Promise.all([
    resolveLastLicenseCheck(clinician),
    resolveNextRevalidation(clinician),
    resolveFppeStatus(clinician),
    resolveOppeStatus(clinician),
    resolveCompactSummary(clinician),
  ]);

  return {
    clinicianId: clinician.id,
    npi: clinician.npi,
    lastLicenseCheck,
    nextRevalidation: nextReval,
    fppeStatus: fppeSummary,
    oppeCycles: oppeSummary,
    compactEligibility: compactSummary,
  };
}

function withinRange(date: Date, start?: Date, end?: Date) {
  if (start && date < start) {
    return false;
  }
  if (end && date > end) {
    return false;
  }
  return true;
}

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value : new Date(value);
}

function cloneJson<T = Record<string, unknown>>(value: Prisma.JsonValue | null | undefined): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function sanitizeNpdbMetadata(metadata: Prisma.JsonValue | null | undefined) {
  const parsed = cloneJson<Record<string, unknown>>(metadata) ?? {};
  const adverseActions = Array.isArray((parsed as any).adverseActions)
    ? ((parsed as any).adverseActions as unknown[])
    : [];
  return {
    npdbStatus: parsed.npdbStatus ?? parsed.status ?? 'UNKNOWN',
    adverseActionCount:
      typeof parsed.adverseActionCount === 'number' ? parsed.adverseActionCount : adverseActions.length || undefined,
  };
}

async function fetchIdentityEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  if (!clinician.npi) {
    return [];
  }

  const events = await prisma.auditEvent.findMany({
    where: {
      subjectNpi: clinician.npi,
      type: { in: Object.keys(IDENTITY_EVENT_TITLES) },
    },
    orderBy: { createdAt: 'desc' },
  });

  return events.map((event) => ({
    id: `identity:${event.id}`,
    phase: 'identity',
    type: event.type,
    title: IDENTITY_EVENT_TITLES[event.type] ?? event.type.replace(/_/g, ' '),
    timestamp: event.createdAt,
    status: event.type.endsWith('_OK') ? 'completed' : 'in_progress',
    source: 'audit_event',
    metadata: cloneJson(event.data),
  }));
}

async function fetchLicenseEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  const [stateVerifications, psvChecks] = await Promise.all([
    prisma.stateLicenseVerification.findMany({
      where: { clinicianId: clinician.id },
      orderBy: { lastCheckedAt: 'desc' },
    }),
    prisma.pSVLicenseCheck.findMany({
      where: { npi: clinician.npi },
      orderBy: { checkedAt: 'desc' },
    }),
  ]);

  const stateEvents = stateVerifications.map((record) => ({
    id: `license:${record.id}`,
    phase: 'licensure' as const,
    type: 'STATE_LICENSE_VERIFICATION',
    title: `${record.state} license ${record.status.toLowerCase()}`,
    timestamp: record.lastCheckedAt ?? record.updatedAt ?? record.createdAt,
    status: LICENSE_STATUS_TO_TIMELINE[record.status],
    source: 'state_board',
    metadata: {
      licenseNumber: record.licenseNumber,
      issueDate: record.issueDate?.toISOString(),
      expiryDate: record.expiryDate?.toISOString(),
      disciplinaryFlag: record.disciplinaryFlag,
    },
  }));

  const psvEvents = psvChecks.map((check) => ({
    id: `psv-license:${check.id}`,
    phase: 'licensure' as const,
    type: 'PSV_LICENSE_CHECK',
    title: `${check.state} license check ${check.status.toLowerCase()}`,
    timestamp: check.checkedAt ?? check.createdAt,
    status: check.status === 'ACTIVE' ? 'completed' : 'warning',
    source: 'psv',
    metadata: {
      licenseNumber: check.licenseNumber,
      sourceUrl: check.sourceUrl,
    },
  }));

  return [...stateEvents, ...psvEvents];
}

async function fetchBoardCredentialEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  const boardCreds = await prisma.credential.findMany({
    where: {
      userId: clinician.userId,
      type: { contains: 'board', mode: 'insensitive' },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return boardCreds.map((credential) => ({
    id: `board:${credential.id}`,
    phase: 'board' as const,
    type: credential.type,
    title: credential.name,
    timestamp: credential.issuedAt ?? credential.createdAt,
    status: normalizeCredentialStatus(credential.status),
    source: credential.issuer ?? 'board_certification',
    metadata: {
      credentialId: credential.id,
      issuer: credential.issuer,
      expiresAt: credential.expiresAt?.toISOString(),
    },
  }));
}

async function fetchDeaCredentialEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  const deaCreds = await prisma.credential.findMany({
    where: {
      userId: clinician.userId,
      type: { contains: 'dea', mode: 'insensitive' },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return deaCreds.map((credential) => ({
    id: `dea:${credential.id}`,
    phase: 'dea' as const,
    type: credential.type,
    title: credential.name || 'DEA registration',
    timestamp: credential.issuedAt ?? credential.createdAt,
    status: normalizeCredentialStatus(credential.status),
    source: credential.issuer ?? 'dea',
    metadata: {
      credentialId: credential.id,
      expiresAt: credential.expiresAt?.toISOString(),
    },
  }));
}

function normalizeCredentialStatus(status: string | null): TimelineEventStatus {
  if (!status) {
    return 'warning';
  }
  const normalized = status.toLowerCase();
  if (normalized === 'active') {
    return 'completed';
  }
  if (normalized === 'expired' || normalized === 'revoked') {
    return 'failed';
  }
  return 'warning';
}

async function fetchEnrollmentEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  if (!clinician.user.did) {
    return [];
  }

  const enrollments = await prisma.payerEnrollment.findMany({
    where: { clinicianDid: clinician.user.did },
    include: {
      payer: true,
      auditEvents: true,
    },
  });

  const events: TimelineEvent[] = [];

  for (const enrollment of enrollments) {
    const payerName = enrollment.payer?.name ?? enrollment.payerId ?? 'Payer enrollment';
    events.push({
      id: `enrollment:${enrollment.id}:created`,
      phase: 'enrollment',
      type: 'PAYER_ENROLLMENT_CREATED',
      title: `${payerName} enrollment created`,
      timestamp: enrollment.createdAt,
      status: 'in_progress',
      source: 'payer_enrollment',
      metadata: {
        enrollmentId: enrollment.id,
        status: enrollment.status,
      },
    });

    if (enrollment.submittedAt) {
      events.push({
        id: `enrollment:${enrollment.id}:submitted`,
        phase: 'enrollment',
        type: 'PAYER_ENROLLMENT_SUBMITTED',
        title: `${payerName} enrollment submitted`,
        timestamp: enrollment.submittedAt,
        status: 'in_progress',
        source: 'payer_enrollment',
      });
    }

    if (enrollment.approvedAt) {
      events.push({
        id: `enrollment:${enrollment.id}:approved`,
        phase: 'enrollment',
        type: 'PAYER_ENROLLMENT_APPROVED',
        title: `${payerName} enrollment approved`,
        timestamp: enrollment.approvedAt,
        status: 'completed',
        source: 'payer_enrollment',
      });
    }

    if (enrollment.terminatedAt) {
      events.push({
        id: `enrollment:${enrollment.id}:terminated`,
        phase: 'enrollment',
        type: 'PAYER_ENROLLMENT_TERMINATED',
        title: `${payerName} enrollment terminated`,
        timestamp: enrollment.terminatedAt,
        status: 'failed',
        source: 'payer_enrollment',
      });
    }

    for (const audit of enrollment.auditEvents) {
      const normalizedType = audit.eventType.toLowerCase();
      const baseEvent: TimelineEvent = {
        id: `enrollment:${enrollment.id}:audit:${audit.id}`,
        phase: NPDB_EVENT_TYPES.has(normalizedType) ? 'quality' : 'enrollment',
        type: audit.eventType,
        title: `${payerName}: ${audit.eventType.replace(/_/g, ' ')}`,
        timestamp: audit.createdAt,
        status: deriveAuditEventStatus(audit.result),
        source: audit.source,
        metadata: NPDB_EVENT_TYPES.has(normalizedType)
          ? sanitizeNpdbMetadata(audit.metadata)
          : cloneJson(audit.metadata),
        sensitive: normalizedType === 'npdb_check',
      };
      events.push(baseEvent);
    }
  }

  return events;
}

function mapEhrTimelineTitle(eventType: string): string {
  switch (eventType) {
    case 'PRIVILEGE_SYNCED':
      return 'Privileges synced to EHR';
    case 'PRIVILEGE_SYNC_FAILED':
      return 'EHR sync failed';
    case 'EHR_MISMATCH_DETECTED':
      return 'EHR mismatch detected';
    default:
      return eventType.replace(/_/g, ' ');
  }
}

function mapEhrTimelineStatus(eventType: string): TimelineEventStatus {
  switch (eventType) {
    case 'PRIVILEGE_SYNCED':
      return 'completed';
    case 'EHR_MISMATCH_DETECTED':
      return 'warning';
    case 'PRIVILEGE_SYNC_FAILED':
    default:
      return 'failed';
  }
}

function deriveAuditEventStatus(result: string | null): TimelineEventStatus {
  const normalized = (result ?? '').toLowerCase();
  if (normalized === 'pass' || normalized === 'approved') {
    return 'completed';
  }
  if (normalized === 'fail' || normalized === 'denied') {
    return 'failed';
  }
  if (normalized === 'warning') {
    return 'warning';
  }
  return 'in_progress';
}

async function fetchPrivilegingEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  if (!clinician.user.did) {
    return [];
  }

  const [requests, auditEvents, renewals] = await Promise.all([
    prisma.privilegeRequest.findMany({
      where: { clinicianDid: clinician.user.did },
      include: {
        privilegeSet: true,
        privilegeGranted: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        type: { startsWith: 'PRIVILEGE_' },
        data: {
          path: ['clinicianDid'],
          equals: clinician.user.did,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.privilegeRenewal.findMany({
      where: {
        privilegeGranted: {
          clinicianDid: clinician.user.did,
        },
      },
      include: {
        privilegeGranted: true,
      },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const request of requests) {
    events.push({
      id: `privilege-request:${request.id}:created`,
      phase: 'privileging',
      type: 'PRIVILEGE_REQUEST_CREATED',
      title: `${request.privilegeSet?.name ?? 'Privilege set'} request submitted`,
      timestamp: request.createdAt,
      status: 'in_progress',
      source: 'privileging',
      metadata: {
        privilegeSetId: request.privilegeSetId,
        privilegeSetName: request.privilegeSet?.name,
        status: request.status,
      },
    });

    if (request.reviewedAt) {
      events.push({
        id: `privilege-request:${request.id}:reviewed`,
        phase: 'privileging',
        type: `PRIVILEGE_REQUEST_${request.status}`,
        title: `${request.privilegeSet?.name ?? 'Privilege request'} ${request.status.toLowerCase()}`,
        timestamp: request.reviewedAt,
        status: request.status === 'APPROVED' ? 'completed' : 'failed',
        source: 'privileging',
        metadata: {
          reviewerDid: request.reviewerDid,
        },
      });
    }

    if (request.privilegeGranted) {
      events.push({
        id: `privilege-granted:${request.privilegeGranted.id}`,
        phase: 'privileging',
        type: 'PRIVILEGE_GRANTED',
        title: `${request.privilegeSet?.name ?? 'Privileges'} granted`,
        timestamp: request.privilegeGranted.grantedAt,
        status: 'completed',
        source: 'privileging',
        metadata: {
          expiresAt: request.privilegeGranted.expiresAt.toISOString(),
          privilegeGrantedId: request.privilegeGranted.id,
        },
      });
    }
  }

  for (const audit of auditEvents) {
    events.push({
      id: `privilege-audit:${audit.id}`,
      phase: 'privileging',
      type: audit.type,
      title: audit.type.replace(/_/g, ' '),
      timestamp: audit.createdAt,
      status: 'completed',
      source: 'audit_event',
      metadata: cloneJson(audit.data),
    });
  }

  for (const renewal of renewals) {
    events.push({
      id: `privilege-renewal:${renewal.id}`,
      phase: 'privileging',
      type: 'PRIVILEGE_RENEWAL',
      title: `Privilege renewal ${renewal.status.toLowerCase()}`,
      timestamp: renewal.dueDate,
      status:
        renewal.status === 'COMPLETE' ? 'completed' : renewal.status === 'OVERDUE' ? 'failed' : 'scheduled',
      source: 'privileging',
      metadata: {
        privilegeGrantedId: renewal.privilegeGrantedId,
        dueDate: renewal.dueDate.toISOString(),
      },
    });
  }

  return events;
}

async function fetchEhrSyncEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  const events = await prisma.credentialTimelineEvent.findMany({
    where: {
      clinicianId: clinician.id,
      eventType: {
        in: ['PRIVILEGE_SYNCED', 'PRIVILEGE_SYNC_FAILED', 'EHR_MISMATCH_DETECTED'],
      },
    },
    orderBy: { timestamp: 'desc' },
  });

  return events.map((event) => ({
    id: `ehr-sync:${event.id}`,
    phase: 'privileging',
    type: event.eventType,
    title: mapEhrTimelineTitle(event.eventType),
    timestamp: event.timestamp,
    status: mapEhrTimelineStatus(event.eventType),
    source: 'ehr_sync',
    metadata: cloneJson(event.metadata),
  }));
}

async function fetchQualityEvents(clinician: ClinicianWithUser): Promise<TimelineEvent[]> {
  if (!clinician.user.did) {
    return [];
  }

  const [fppeCases, oppeCases, revalidationTasks, npdbMonitors, qualitySignals] = await Promise.all([
    prisma.fPPECase.findMany({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.oPPECase.findMany({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.revalidationTask.findMany({
      where: {
        clinicianId: clinician.id,
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.npdbOigMonitor.findMany({
      where: {
        OR: [{ clinicianDid: clinician.user.did }, { npi: clinician.npi }],
      },
      orderBy: { checkDate: 'desc' },
    }),
    prisma.qualitySignal.findMany({
      where: { clinicianId: clinician.id },
      orderBy: { timestamp: 'desc' },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const fppe of fppeCases) {
    events.push({
      id: `fppe:${fppe.id}`,
      phase: 'quality',
      type: 'FPPE_CASE',
      title: `FPPE case ${fppe.status.toLowerCase()}`,
      timestamp: fppe.createdAt,
      status: mapFppeStatus(fppe.status),
      source: 'fppe',
      metadata: {
        privilegeCode: fppe.privilegeCode,
        dueAt: fppe.dueAt.toISOString(),
      },
    });
    if (fppe.completedAt) {
      events.push({
        id: `fppe:${fppe.id}:completed`,
        phase: 'quality',
        type: 'FPPE_CASE_COMPLETED',
        title: 'FPPE case completed',
        timestamp: fppe.completedAt,
        status: 'completed',
        source: 'fppe',
      });
    }
  }

  for (const oppe of oppeCases) {
    events.push({
      id: `oppe:${oppe.id}`,
      phase: 'quality',
      type: 'OPPE_CASE',
      title: `OPPE case ${oppe.status.toLowerCase()}`,
      timestamp: oppe.createdAt,
      status: oppe.status === 'COMPLETED' ? 'completed' : oppe.status === 'FAILED' ? 'failed' : 'in_progress',
      source: 'oppe',
      metadata: {
        privilegeCode: oppe.privilegeCode,
        periodStart: oppe.periodStart.toISOString(),
        periodEnd: oppe.periodEnd.toISOString(),
      },
    });
  }

  for (const task of revalidationTasks) {
    const phase = mapRevalidationCategory(task.category);
    const status = mapRevalidationStatus(task.status);
    events.push({
      id: `revalidation:${task.id}`,
      phase,
      type: 'REVALIDATION_TASK',
      title: `${task.type} revalidation ${task.status.toLowerCase()}`,
      timestamp: task.dueDate,
      status,
      source: 'revalidation',
      metadata: {
        taskId: task.id,
        dueDate: task.dueDate.toISOString(),
        category: task.category,
      },
    });
  }

  for (const monitor of npdbMonitors) {
    events.push({
      id: `monitor:${monitor.id}`,
      phase: 'quality',
      type: monitor.monitorType === 'NPDB' ? 'NPDB_MONITOR' : 'OIG_MONITOR',
      title: `${monitor.monitorType} check ${monitor.status.toLowerCase()}`,
      timestamp: monitor.checkDate,
      status: monitor.status === 'CLEAN' ? 'completed' : 'warning',
      source: 'compliance_monitor',
      metadata: {
        status: monitor.status,
        privilegeAction: monitor.privilegeAction,
      },
      sensitive: monitor.monitorType === 'NPDB',
    });
  }

  for (const signal of qualitySignals) {
    events.push({
      id: `quality-signal:${signal.id}`,
      phase: 'quality',
      type: `QUALITY_SIGNAL_${signal.signalType}`,
      title: signal.signalType.replace(/_/g, ' '),
      timestamp: signal.timestamp,
      status: mapQualitySignalSeverity(signal.severity),
      source: signal.source ?? 'quality_signal',
      metadata: {
        severity: signal.severity,
        details: signal.details,
      },
    });
  }

  return events;
}

function mapFppeStatus(status: string): TimelineEventStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'IN_REVIEW':
      return 'in_progress';
    default:
      return 'in_progress';
  }
}

function mapQualitySignalSeverity(severity: string): TimelineEventStatus {
  switch (severity) {
    case 'CRITICAL':
      return 'failed';
    case 'HIGH':
    case 'MED':
      return 'warning';
    default:
      return 'in_progress';
  }
}

function mapRevalidationCategory(category?: string | null): TimelineEvent['phase'] {
  const normalized = category?.toUpperCase() ?? 'CREDENTIALING';
  return categoryPhaseMap[normalized] ?? 'quality';
}

const categoryPhaseMap: Record<string, TimelineEvent['phase']> = {
  PECOS: 'enrollment',
  MEDICAID: 'enrollment',
  PAYER: 'enrollment',
  DEA: 'dea',
  STATE_LICENSE: 'licensure',
  CREDENTIALING: 'quality',
};

function mapRevalidationStatus(status: RevalidationTaskStatus): TimelineEventStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'OVERDUE':
      return 'failed';
    case 'IN_PROGRESS':
      return 'in_progress';
    default:
      return 'pending';
  }
}

async function resolveLastLicenseCheck(
  clinician: ClinicianWithUser
): Promise<TimelineSummary['lastLicenseCheck']> {
  const [stateCheck] = await prisma.stateLicenseVerification.findMany({
    where: { clinicianId: clinician.id },
    orderBy: { lastCheckedAt: 'desc' },
    take: 1,
  });

  if (stateCheck) {
    return {
      state: stateCheck.state,
      status: stateCheck.status,
      checkedAt: (stateCheck.lastCheckedAt ?? stateCheck.updatedAt ?? stateCheck.createdAt).toISOString(),
      source: 'state_license',
    };
  }

  const [psvCheck] = await prisma.pSVLicenseCheck.findMany({
    where: { npi: clinician.npi },
    orderBy: { checkedAt: 'desc' },
    take: 1,
  });

  if (psvCheck) {
    return {
      state: psvCheck.state,
      status: psvCheck.status,
      checkedAt: (psvCheck.checkedAt ?? psvCheck.createdAt).toISOString(),
      source: 'psv_license',
    };
  }

  return undefined;
}

async function resolveNextRevalidation(
  clinician: ClinicianWithUser
): Promise<TimelineSummary['nextRevalidation']> {
  const [task] = await prisma.revalidationTask.findMany({
    where: {
      clinicianId: clinician.id,
      status: { not: 'COMPLETED' },
    },
    orderBy: { dueDate: 'asc' },
    take: 1,
  });

  if (task) {
    return {
      dueAt: task.dueDate.toISOString(),
      source: 'revalidation_task',
      referenceId: task.id,
      category: task.type,
    };
  }

  const [enrollment] = await prisma.payerEnrollment.findMany({
    where: {
      clinicianDid: clinician.user.did ?? undefined,
      revalidationDueAt: { not: null },
    },
    orderBy: { revalidationDueAt: 'asc' },
    take: 1,
  });

  if (enrollment?.revalidationDueAt) {
    return {
      dueAt: enrollment.revalidationDueAt.toISOString(),
      source: 'payer_enrollment',
      referenceId: enrollment.id,
    };
  }

  const [pecos] = await prisma.pecosRevalidation.findMany({
    where: {
      npi: clinician.npi,
      completed: false,
    },
    orderBy: { dueDate: 'asc' },
    take: 1,
  });

  if (pecos) {
    return {
      dueAt: pecos.dueDate.toISOString(),
      source: 'pecos',
      referenceId: pecos.id,
    };
  }

  return undefined;
}

async function resolveFppeStatus(clinician: ClinicianWithUser): Promise<TimelineSummary['fppeStatus']> {
  if (!clinician.user.did) {
    return undefined;
  }

  const fppe = await prisma.fppeOppe.findFirst({
    where: { clinicianDid: clinician.user.did },
    orderBy: { updatedAt: 'desc' },
  });

  if (!fppe) {
    return undefined;
  }

  return {
    status: fppe.fppeStatus,
    startedAt: fppe.fppeStartDate?.toISOString(),
    updatedAt: fppe.updatedAt.toISOString(),
    notes: fppe.notes ?? undefined,
  };
}

async function resolveOppeStatus(clinician: ClinicianWithUser): Promise<TimelineSummary['oppeCycles']> {
  if (!clinician.user.did) {
    return undefined;
  }

  const oppe = await prisma.fppeOppe.findFirst({
    where: { clinicianDid: clinician.user.did },
    orderBy: { updatedAt: 'desc' },
  });

  if (!oppe) {
    return undefined;
  }

  return {
    status: oppe.oppeStatus,
    nextReviewDue: oppe.oppeNextReviewDue?.toISOString(),
    lastReviewedAt: oppe.oppeLastReviewDate?.toISOString(),
  };
}

async function resolveCompactSummary(
  clinician: ClinicianWithUser
): Promise<TimelineSummary['compactEligibility']> {
  const compacts = await prisma.clinicianCompactWallet.findMany({
    where: { clinicianId: clinician.id },
    orderBy: { updatedAt: 'desc' },
  });

  if (compacts.length === 0) {
    return undefined;
  }

  return {
    activeCompacts: compacts.length,
    lastUpdated: compacts[0].updatedAt.toISOString(),
    compacts: compacts.map((entry) => ({
      type: entry.compactType,
      homeState: entry.homeState,
      expiresAt: entry.expiresAt?.toISOString(),
    })),
  };
}


