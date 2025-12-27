import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export enum RiskStatus {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_VALIDITY_DAYS = 365;
const MEDIUM_WINDOW_DAYS = 90;
const HIGH_WINDOW_DAYS = 30;

export type CredentialRiskWindow = {
  credentialId: string;
  credentialName: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  daysUntilExpiry: number;
  missingRenewal: boolean;
  status: RiskStatus;
};

export type EmployerRiskEvaluation = {
  clinicianId: number;
  jobId: number;
  risk: RiskStatus;
  windows: CredentialRiskWindow[];
  missingRenewals: boolean;
  jobAligned: boolean;
  computedAt: string;
  rules: {
    validityDays: number;
    mediumWindowDays: number;
    highWindowDays: number;
  };
};

type PulseEventType = 'CANDIDATE_AT_RISK' | 'ELIGIBILITY_AT_RISK';

function emitPulseEvent(event: PulseEventType, payload: Record<string, unknown>): void {
  log('info', 'pulse_event', {
    event,
    ...payload,
  });
}

function normalizeCredentialExpiry(issuedAt: Date): { expiresAt: Date; daysUntilExpiry: number } {
  const expiresAt = new Date(issuedAt.getTime() + DEFAULT_VALIDITY_DAYS * MS_PER_DAY);
  const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / MS_PER_DAY);
  return { expiresAt, daysUntilExpiry };
}

function assessWindow(daysUntilExpiry: number): { status: RiskStatus; missingRenewal: boolean } {
  if (daysUntilExpiry < 0) return { status: RiskStatus.HIGH, missingRenewal: true };
  if (daysUntilExpiry <= HIGH_WINDOW_DAYS) return { status: RiskStatus.HIGH, missingRenewal: false };
  if (daysUntilExpiry <= MEDIUM_WINDOW_DAYS)
    return { status: RiskStatus.MEDIUM, missingRenewal: false };
  return { status: RiskStatus.LOW, missingRenewal: false };
}

function aggregateRisk(windows: CredentialRiskWindow[], missingRenewals: boolean): RiskStatus {
  if (missingRenewals || windows.some((w) => w.status === RiskStatus.HIGH)) return RiskStatus.HIGH;
  if (windows.some((w) => w.status === RiskStatus.MEDIUM)) return RiskStatus.MEDIUM;
  return RiskStatus.LOW;
}

export async function computeEmployerRisk(
  clinicianId: number,
  jobId: number,
): Promise<EmployerRiskEvaluation> {
  const [clinician, job] = await Promise.all([
    prisma.user.findUnique({
      where: { id: clinicianId },
      include: { credentials: true },
    }),
    prisma.job.findUnique({ where: { id: jobId } }),
  ]);

  if (!clinician) throw new Error('clinician_not_found');
  if (!job) throw new Error('job_not_found');

  const windows: CredentialRiskWindow[] = clinician.credentials.map((credential) => {
    const { expiresAt, daysUntilExpiry } = normalizeCredentialExpiry(credential.issuedAt);
    const { status, missingRenewal } = assessWindow(daysUntilExpiry);
    return {
      credentialId: `CRED-${credential.id}`,
      credentialName: credential.name,
      issuer: credential.issuer,
      issuedAt: credential.issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      daysUntilExpiry,
      missingRenewal,
      status,
    };
  });

  const missingRenewals = windows.some((w) => w.missingRenewal) || windows.length === 0;
  const risk = aggregateRisk(windows, missingRenewals);
  const jobAligned = job.userId === clinicianId;

  if (risk !== RiskStatus.LOW) {
    const payload = {
      clinicianId,
      jobId,
      jobAligned,
      risk,
      credentialCount: windows.length,
      missingRenewals,
    };
    emitPulseEvent('CANDIDATE_AT_RISK', payload);
    emitPulseEvent('ELIGIBILITY_AT_RISK', payload);
  }

  return {
    clinicianId,
    jobId,
    risk,
    windows,
    missingRenewals,
    jobAligned,
    computedAt: new Date().toISOString(),
    rules: {
      validityDays: DEFAULT_VALIDITY_DAYS,
      mediumWindowDays: MEDIUM_WINDOW_DAYS,
      highWindowDays: HIGH_WINDOW_DAYS,
    },
  };
}
