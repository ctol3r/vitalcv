import { PrismaClient, Prisma } from '@prisma/client';
import { CredentialRiskFactors } from './enums';
import { CredentialRiskDetails } from './models/CredentialRisk';

const prisma = new PrismaClient();

type MaybeDate = Date | string | null | undefined;

export const BASELINE_FACTOR_WEIGHTS: Record<CredentialRiskFactors, number> = {
  [CredentialRiskFactors.LICENSE_EXPIRED]: 25,
  [CredentialRiskFactors.NPDB_HIT]: 40,
  [CredentialRiskFactors.DEA_EXPIRED]: 20,
  [CredentialRiskFactors.BOARD_EXPIRED]: 15,
  [CredentialRiskFactors.PECOS_REVOKED]: 25,
  [CredentialRiskFactors.SANCTION_FLAG]: 30,
  [CredentialRiskFactors.LOW_OPPE]: 20,
  [CredentialRiskFactors.FAILED_FPPE]: 25,
  [CredentialRiskFactors.OUT_OF_STATE_WITHOUT_COMPACT]: 15,
  [CredentialRiskFactors.MULTIPLE_DISCIPLINARY_ACTIONS]: 25,
};

const OPEN_TASK_STATUSES = new Set(['OPEN', 'OVERDUE', 'IN_PROGRESS']);
const NEGATIVE_LICENSE_STATUSES = new Set(['EXPIRED', 'SUSPENDED', 'REVOKED', 'INACTIVE']);
const NEGATIVE_PECOS_STATUSES = new Set(['REJECTED', 'DEACTIVATED', 'TERMINATED', 'REVOKED']);

export interface LicenseVerificationSnapshot {
  state: string;
  status?: string | null;
  expiryDate?: Date | null;
  disciplinaryFlag?: boolean | null;
}

export interface CredentialSnapshot {
  status?: string | null;
  expiresAt?: Date | null;
}

export interface RevalidationTaskSnapshot {
  status: string;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BaselineRiskData {
  clinicianId: string;
  clinicianDid?: string | null;
  homeState?: string | null;
  psvResult?: {
    overallStatus: string;
    sanctionFlag: boolean;
    licenseStatus?: string | null;
  };
  licenses: LicenseVerificationSnapshot[];
  pecosEnrollments: Array<{ enrollmentType: string; status: string }>;
  deaCredentials: CredentialSnapshot[];
  boardCredentials: CredentialSnapshot[];
  revalidationTasks: RevalidationTaskSnapshot[];
  npdbFindings: Array<{ status: string }>;
  compacts?: {
    imlcStates: string[];
    psypactStates: string[];
    counselingStates: string[];
    imlcStatus?: string | null;
  } | null;
  oppeCases: Array<{ status: string; metrics?: Record<string, unknown> | null }>;
  fppeSummary?: {
    fppeStatus?: string | null;
    fppeEndDate?: Date | null;
    oppeStatus?: string | null;
    oppeNextReviewDue?: Date | null;
  };
}

export interface BaselineRiskResult {
  clinicianId: string;
  score: number;
  factors: CredentialRiskFactors[];
  details: CredentialRiskDetails;
  asOf: Date;
  data: BaselineRiskData;
}

export interface EvaluateRiskOptions {
  asOf?: Date;
  client?: PrismaClient;
}

export async function evaluateCredentialRisk(
  clinicianId: string,
  options: EvaluateRiskOptions = {}
): Promise<BaselineRiskResult> {
  const client = options.client ?? prisma;
  const data = await loadBaselineRiskData(clinicianId, client);
  return runBaselineRules(data, options.asOf);
}

export async function loadBaselineRiskData(
  clinicianId: string,
  client: PrismaClient = prisma
): Promise<BaselineRiskData> {
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    select: {
      id: true,
      userId: true,
      state: true,
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const didLink = await client.didUserLink.findFirst({
    where: { userId: clinician.userId },
    select: { did: true },
  });

  const clinicianDid = didLink?.did ?? null;

  const [
    compactsStatus,
    psvResult,
    licenses,
    pecosProviders,
    credentials,
    oppeCases,
    fppeSummary,
    revalidationTasks,
    npdbEvents,
  ] = await Promise.all([
    clinicianDid
      ? client.compactsStatus.findUnique({
          where: { clinicianDid },
        })
      : null,
    client.pSVResult.findFirst({
      where: { clinicianId },
      orderBy: { checkedAt: 'desc' },
      include: {
        sanctionsCheck: true,
        licenseCheck: true,
      },
    }),
    client.stateLicenseVerification.findMany({ where: { clinicianId } }),
    client.pECOSProvider.findMany({ where: { clinicianId } }),
    client.credential.findMany({
      where: {
        userId: clinician.userId,
        type: { in: ['DEARegistration', 'BoardCertification'] },
      },
      select: {
        type: true,
        status: true,
        expiresAt: true,
      },
    }),
    client.oPPECase.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    clinicianDid
      ? client.fppeOppe.findFirst({
          where: { clinicianDid },
          orderBy: { updatedAt: 'desc' },
        })
      : null,
    client.revalidationTask.findMany({
      where: { clinicianId },
      orderBy: { dueDate: 'asc' },
    }),
    clinicianDid
      ? client.npdbOigMonitor.findMany({
          where: { clinicianDid, monitorType: 'NPDB' },
          orderBy: { checkDate: 'desc' },
          take: 5,
        })
      : [],
  ]);

  const deaCredentials = credentials
    .filter((cred) => cred.type === 'DEARegistration')
    .map((cred) => ({
      status: cred.status,
      expiresAt: cred.expiresAt ?? null,
    }));

  const boardCredentials = credentials
    .filter((cred) => cred.type === 'BoardCertification')
    .map((cred) => ({
      status: cred.status,
      expiresAt: cred.expiresAt ?? null,
    }));

  const licensesSnapshot: LicenseVerificationSnapshot[] = licenses.map((license) => ({
    state: license.state,
    status: license.status,
    expiryDate: license.expiryDate ?? null,
    disciplinaryFlag: license.disciplinaryFlag,
  }));

  const revalidationSnapshot: RevalidationTaskSnapshot[] = revalidationTasks.map((task) => ({
    status: task.status,
    category: (task.metadata as Prisma.JsonObject | null)?.category as string | undefined,
    metadata: (task.metadata as Prisma.JsonObject | null) ?? null,
  }));

  return {
    clinicianId,
    clinicianDid,
    homeState: clinician.state,
    psvResult: psvResult
      ? {
          overallStatus: psvResult.overallStatus,
          sanctionFlag: Boolean(psvResult.sanctionsCheck?.sanctioned),
          licenseStatus: psvResult.licenseCheck?.status,
        }
      : undefined,
    licenses: licensesSnapshot,
    pecosEnrollments: pecosProviders.map((record) => ({
      enrollmentType: record.enrollmentType,
      status: record.status,
    })),
    deaCredentials,
    boardCredentials,
    revalidationTasks: revalidationSnapshot,
    npdbFindings: npdbEvents.map((event) => ({
      status: event.status,
    })),
    compacts: compactsStatus
      ? {
          imlcStates: compactsStatus.imlcCompactStates ?? [],
          psypactStates: compactsStatus.psypactStates ?? [],
          counselingStates: compactsStatus.counselingStates ?? [],
          imlcStatus: compactsStatus.imlcStatus,
        }
      : null,
    oppeCases: oppeCases.map((oppe) => ({
      status: oppe.status,
      metrics: oppe.metrics as Record<string, unknown> | null,
    })),
    fppeSummary: fppeSummary
      ? {
          fppeStatus: fppeSummary.fppeStatus,
          fppeEndDate: fppeSummary.fppeEndDate,
          oppeStatus: fppeSummary.oppeStatus,
          oppeNextReviewDue: fppeSummary.oppeNextReviewDue,
        }
      : undefined,
  };
}

export function runBaselineRules(
  data: BaselineRiskData,
  asOfInput?: Date
): BaselineRiskResult {
  const asOf = asOfInput ?? new Date();
  const details: CredentialRiskDetails = {};
  const factors = new Set<CredentialRiskFactors>();

  const addFactor = (factor: CredentialRiskFactors, reason: string) => {
    if (!factors.has(factor)) {
      factors.add(factor);
    }
    details[factor] = reason;
  };

  const nowMs = asOf.getTime();

  const hasLicenseIssue =
    data.licenses.some((license) => {
      const status = normalizeStatus(license.status);
      if (NEGATIVE_LICENSE_STATUSES.has(status)) return true;
      if (isPast(license.expiryDate, nowMs)) return true;
      return false;
    }) ||
    hasRevalidationCategory(data.revalidationTasks, 'STATE_LICENSE');

  if (hasLicenseIssue) {
    addFactor(
      CredentialRiskFactors.LICENSE_EXPIRED,
      'At least one state license is expired, inactive, or has an open remediation task.'
    );
  }

  const hasDeaIssue =
    data.deaCredentials.length === 0 ||
    data.deaCredentials.some((cred) => {
      const status = normalizeStatus(cred.status);
      return status !== 'ACTIVE' || isPast(cred.expiresAt, nowMs);
    }) ||
    hasRevalidationCategory(data.revalidationTasks, 'DEA');

  if (hasDeaIssue) {
    addFactor(
      CredentialRiskFactors.DEA_EXPIRED,
      'DEA registration is missing, expired, or flagged for remediation.'
    );
  }

  const hasBoardIssue =
    data.boardCredentials.some((cred) => {
      const status = normalizeStatus(cred.status);
      return status === 'LAPSED' || status === 'INACTIVE' || isPast(cred.expiresAt, nowMs);
    }) ||
    hasRevalidationCategory(data.revalidationTasks, 'BOARD');

  if (hasBoardIssue) {
    addFactor(
      CredentialRiskFactors.BOARD_EXPIRED,
      'Board certification has lapsed or is flagged in revalidation tasks.'
    );
  }

  const hasPecosIssue = data.pecosEnrollments.some((enrollment) =>
    NEGATIVE_PECOS_STATUSES.has(normalizeStatus(enrollment.status))
  );
  if (hasPecosIssue) {
    addFactor(
      CredentialRiskFactors.PECOS_REVOKED,
      'CMS PECOS enrollment shows a deactivated or rejected status.'
    );
  }

  const sanctionFlag =
    Boolean(data.psvResult?.sanctionFlag) ||
    data.licenses.some((license) => license.disciplinaryFlag);
  if (sanctionFlag) {
    addFactor(
      CredentialRiskFactors.SANCTION_FLAG,
      'OIG/LEIE sanction or disciplinary flag detected in PSV results.'
    );
  }

  const npdbHit = data.npdbFindings.some(
    (finding) => normalizeStatus(finding.status) === 'ADVERSE_ACTION'
  );
  if (npdbHit) {
    addFactor(
      CredentialRiskFactors.NPDB_HIT,
      'Recent NPDB adverse action exists for this clinician.'
    );
  }

  const lowOppe =
    data.oppeCases.some((oppe) => {
      if (normalizeStatus(oppe.status) === 'FAILED') return true;
      const metrics = oppe.metrics ?? {};
      const complications = Number(metrics?.complications ?? 0);
      const issues = Number(metrics?.issuesFlagged ?? 0);
      return complications >= 3 || issues >= 1;
    }) ||
    normalizeStatus(data.fppeSummary?.oppeStatus) === 'HOLD' ||
    (data.fppeSummary?.oppeNextReviewDue &&
      isPast(data.fppeSummary.oppeNextReviewDue, nowMs));

  if (lowOppe) {
    addFactor(
      CredentialRiskFactors.LOW_OPPE,
      'OPPE monitoring shows failed cases or outstanding performance issues.'
    );
  }

  const failedFppe =
    normalizeStatus(data.fppeSummary?.fppeStatus) === 'FAILED' ||
    (normalizeStatus(data.fppeSummary?.fppeStatus) === 'IN_PROGRESS' &&
      data.fppeSummary?.fppeEndDate &&
      isPast(data.fppeSummary.fppeEndDate, nowMs));

  if (failedFppe) {
    addFactor(
      CredentialRiskFactors.FAILED_FPPE,
      'FPPE evaluation failed or remains incomplete past its due date.'
    );
  }

  const outOfStateIssue =
    data.homeState &&
    data.licenses.some((license) => {
      if (!license.state || license.state === data.homeState) return false;
      const inactive =
        NEGATIVE_LICENSE_STATUSES.has(normalizeStatus(license.status)) ||
        isPast(license.expiryDate, nowMs);
      if (!inactive) return false;
      const compactStates = new Set(
        [
          ...(data.compacts?.imlcStates ?? []),
          ...(data.compacts?.psypactStates ?? []),
          ...(data.compacts?.counselingStates ?? []),
        ].map((state) => state?.toUpperCase())
      );
      return !compactStates.has(license.state.toUpperCase());
    });

  if (outOfStateIssue) {
    addFactor(
      CredentialRiskFactors.OUT_OF_STATE_WITHOUT_COMPACT,
      'Non-home-state licensure gaps detected without compact coverage.'
    );
  }

  const disciplinarySignals =
    (sanctionFlag ? 1 : 0) +
    data.npdbFindings.filter(
      (finding) => normalizeStatus(finding.status) === 'ADVERSE_ACTION'
    ).length +
    data.licenses.filter((license) => Boolean(license.disciplinaryFlag)).length;

  if (disciplinarySignals >= 2) {
    addFactor(
      CredentialRiskFactors.MULTIPLE_DISCIPLINARY_ACTIONS,
      'Multiple disciplinary events (NPDB, sanctions, or board actions) detected.'
    );
  }

  let score = Array.from(factors).reduce(
    (total, factor) => total + (BASELINE_FACTOR_WEIGHTS[factor] ?? 0),
    0
  );
  score = Math.min(100, Math.max(0, Math.round(score)));

  const orderedFactors = Array.from(factors).sort((a, b) => {
    const diff = (BASELINE_FACTOR_WEIGHTS[b] ?? 0) - (BASELINE_FACTOR_WEIGHTS[a] ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  return {
    clinicianId: data.clinicianId,
    score,
    factors: orderedFactors,
    details,
    asOf,
    data,
  };
}

function hasRevalidationCategory(
  tasks: RevalidationTaskSnapshot[],
  category: string
): boolean {
  const matchCategory = category.toUpperCase();
  return tasks.some((task) => {
    if (!OPEN_TASK_STATUSES.has(normalizeStatus(task.status))) return false;
    const metaCategory = (task.category ?? '').toUpperCase();
    return metaCategory === matchCategory;
  });
}

function normalizeStatus(value?: string | null): string {
  return (value ?? '').toUpperCase();
}

function isPast(value: MaybeDate, referenceMs: number): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime() < referenceMs;
}

