import { PrismaClient } from '@prisma/client';
import { normalizeMetrics } from './models/OPPECase';

const prisma = new PrismaClient();

export interface RenewalCheckResult {
  name: string;
  met: boolean;
  details: string;
  weight: number;
}

export interface RenewalEngineV2Result {
  passed: boolean;
  score: number;
  checks: RenewalCheckResult[];
  summary: string;
}

const CHECK_WEIGHTS = {
  boardCertification: 20,
  license: 25,
  dea: 10,
  fppe: 10,
  oppe: 20,
  psvFreshness: 15,
};

export async function evaluateRenewalCriteriaV2(privilegeGrantedId: string): Promise<RenewalEngineV2Result> {
  const privilege = await prisma.privilegeGranted.findUnique({
    where: { id: privilegeGrantedId },
    include: {
      privilegeRequest: true,
      oppeCases: {
        orderBy: { periodEnd: 'desc' },
        take: 5,
      },
    },
  });

  if (!privilege) {
    throw new Error(`PrivilegeGranted ${privilegeGrantedId} not found`);
  }

  const evidenceIds = privilege.privilegeRequest?.evidenceIds ?? [];
  const evidenceVCs = evidenceIds.length
    ? await prisma.credential.findMany({
        where: {
          id: { in: evidenceIds },
        },
      })
    : [];

  const checks: RenewalCheckResult[] = [];
  const boardCheck = hasActiveCredential(evidenceVCs, 'BoardCertification');
  checks.push({
    name: 'Board Certification',
    met: boardCheck.met,
    details: boardCheck.details,
    weight: CHECK_WEIGHTS.boardCertification,
  });

  const licenseCheck = hasFreshLicense(evidenceVCs);
  checks.push({
    name: 'Active License',
    met: licenseCheck.met,
    details: licenseCheck.details,
    weight: CHECK_WEIGHTS.license,
  });

  const deaCheck = hasActiveCredential(evidenceVCs, 'DEARegistration');
  checks.push({
    name: 'DEA Registration',
    met: deaCheck.met,
    details: deaCheck.details,
    weight: CHECK_WEIGHTS.dea,
  });

  const fppeCheck = await evaluateFppe(privilege);
  checks.push({
    name: 'FPPE Completion',
    met: fppeCheck.met,
    details: fppeCheck.details,
    weight: CHECK_WEIGHTS.fppe,
  });

  const oppeCheck = await evaluateOppe(privilege);
  checks.push({
    name: 'OPPE Performance',
    met: oppeCheck.met,
    details: oppeCheck.details,
    weight: CHECK_WEIGHTS.oppe,
  });

  const psvCheck = checkPSVFreshness(evidenceVCs);
  checks.push({
    name: 'PSV Freshness',
    met: psvCheck.met,
    details: psvCheck.details,
    weight: CHECK_WEIGHTS.psvFreshness,
  });

  const { score, passed } = gradeChecks(checks);
  const summary = passed
    ? `Renewal PASSED (${score}/100)`
    : `Renewal FAILED – ${checks.filter((c) => !c.met).length} blockers`;

  return {
    passed,
    score,
    checks,
    summary,
  };
}

function hasActiveCredential(evidenceVCs: any[], type: string) {
  const credential = evidenceVCs.find(
    (vc) => vc.type === type && vc.status === 'active' && !isExpired(vc.expiresAt)
  );
  if (credential) {
    return { met: true, details: `${type} valid through ${formatDate(credential.expiresAt)}` };
  }
  return { met: false, details: `${type} missing or expired` };
}

function hasFreshLicense(evidenceVCs: any[]) {
  const license = evidenceVCs.find((vc) => vc.type === 'MedicalLicense' && vc.status === 'active');
  if (!license) {
    return { met: false, details: 'No active license credential' };
  }
  const expired = isExpired(license.expiresAt);
  if (expired) {
    return { met: false, details: 'License expired' };
  }
  return { met: true, details: 'License active and current' };
}

async function evaluateFppe(privilege: any) {
  const record = await prisma.fppeOppe.findFirst({
    where: { privilegeRequestId: privilege.privilegeRequestId },
  });
  if (!record) {
    return { met: false, details: 'No FPPE record found' };
  }
  return {
    met: record.fppeStatus === 'COMPLETED',
    details: `Status: ${record.fppeStatus}`,
  };
}

async function evaluateOppe(privilege: any) {
  const schedule = await prisma.oPPEScheduleV2.findUnique({
    where: {
      clinicianId_orgId: {
        clinicianId: privilege.clinicianDid,
        orgId: privilege.orgId,
      },
    },
  });

  const latestCase = privilege.oppeCases?.find((c: any) => c.status === 'COMPLETED');
  if (!latestCase) {
    return { met: false, details: 'No completed OPPE case' };
  }

  const metrics = normalizeMetrics(latestCase.metrics);
  const targetCases = schedule?.metricsConfig?.cases ?? 0;
  const meetsVolume = targetCases === 0 || (metrics.caseCount ?? 0) >= targetCases;

  return {
    met: meetsVolume,
    details: meetsVolume
      ? `Latest OPPE case ${latestCase.id} meets targets`
      : `OPPE case ${latestCase.id} below target (${metrics.caseCount ?? 0}/${targetCases})`,
  };
}

function checkPSVFreshness(evidenceVCs: any[]) {
  const now = Date.now();
  const maxAgeDays = 180;
  const staleItems = evidenceVCs.filter((vc) => {
    if (!vc.issuedAt) return false;
    const issued = new Date(vc.issuedAt);
    const ageDays = Math.floor((now - issued.getTime()) / (1000 * 60 * 60 * 24));
    return ageDays > maxAgeDays;
  });

  if (staleItems.length > 0) {
    return {
      met: false,
      details: `${staleItems.length} PSV item(s) older than ${maxAgeDays} days`,
    };
  }

  return {
    met: true,
    details: 'PSV evidence within 180-day freshness window',
  };
}

function gradeChecks(checks: RenewalCheckResult[]) {
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + (check.met ? check.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);
  const passed = checks.every((check) => check.met);
  return { score, passed };
}

function isExpired(date: Date | string | null | undefined) {
  if (!date) return false;
  const expires = new Date(date);
  return expires.getTime() < Date.now();
}

function formatDate(value: Date | string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString();
}
