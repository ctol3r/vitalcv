/**
 * B137A-ENROLL-010 & B169C-PAYER-004: Enrollment requirements engine
 */

import { PrismaClient } from '@prisma/client';
import type { CaqhProfile } from './caqhClient.js';
import type { PecosEnrollmentStatus } from './pecosClient.js';
import type { PayerRecord } from './models/Payer.js';
import type { CaqhProfileFields } from './models/CAQHProfile.js';
import type { RequirementDefinition } from './models/PayerRequirements.js';

const prisma = new PrismaClient();

export interface EnrollmentRequirementsCheck {
  payerId: string;
  clinicianDid: string;
  specialty: string;
  state: string;
  caqhProfile?: CaqhProfile;
  caqhFields?: CaqhProfileFields;
  pecosStatus?: PecosEnrollmentStatus;
  clinicianProfile?: ClinicianProfileSummary;
  psvResult?: PsvResultSummary;
  payerRequirements?: RequirementDefinition[];
}

export interface ClinicianProfileSummary {
  id?: string;
  npi?: string;
  specialty?: string;
  state?: string;
  fullName?: string;
}

export interface PsvResultSummary {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  checkedAt: string;
  sanctionsStatus?: 'CLEAN' | 'ADVERSE_ACTION' | 'UNKNOWN';
}

export interface RequirementResult {
  requirement: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE';
  details: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  nextAction?: string;
  source?: 'system' | 'template';
}

export interface EnrollmentRequirementsResult {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  eligibleForEnrollment: boolean;
  results: RequirementResult[];
  criticalFailures: string[];
  warnings: string[];
  timestamp: Date;
}

interface NormalizedCaqhData {
  caqhId?: string;
  status?: string;
  attestationDate?: string;
  expirationDate?: string;
  lastUpdatedAt?: string;
  licenses: Array<{
    licenseNumber: string;
    state: string;
    licenseType: string;
    issueDate: string;
    expirationDate: string;
    status: 'Active' | 'Inactive' | 'Expired';
  }>;
  boardCertifications: Array<{
    board: string;
    specialty: string;
    certificationNumber: string;
    issueDate: string;
    expirationDate: string;
    status: 'Active' | 'Expired';
  }>;
  malpractice?: {
    carrier: string;
    policyNumber: string;
    coverageAmount: number;
    expirationDate: string;
  } | null;
}

interface TemplateRequirementContext {
  caqh?: NormalizedCaqhData | null;
  pecosStatus?: PecosEnrollmentStatus;
  clinicianProfile?: ClinicianProfileSummary;
  targetState: string;
}

export async function checkEnrollmentRequirements(
  check: EnrollmentRequirementsCheck,
  payer: PayerRecord
): Promise<EnrollmentRequirementsResult> {
  const results: RequirementResult[] = [];
  const criticalFailures: string[] = [];
  const warnings: string[] = [];
  const normalizedCaqh = normalizeCaqhData(check.caqhProfile, check.caqhFields);

  if (payer.requiresCaqh) {
    const caqhResult = checkCaqhRequirement(normalizedCaqh);
    results.push(caqhResult);
    if (caqResultIsCriticalFailure(caqhResult)) {
      criticalFailures.push(caqhResult.details);
    } else if (caqResultIsWarning(caqhResult)) {
      warnings.push(caqhResult.details);
    }
  }

  if (payer.requiresPecos) {
    const pecosResult = checkPecosRequirement(check.pecosStatus);
    results.push(pecosResult);
    if (pecosResult.status === 'FAIL' && pecosResult.severity === 'critical') {
      criticalFailures.push(pecosResult.details);
    } else if (pecosResult.status === 'WARNING') {
      warnings.push(pecosResult.details);
    }
  }

  const specialtyResult = checkSpecialtyRequirement(check.specialty, payer);
  results.push(specialtyResult);
  if (specialtyResult.status === 'FAIL') {
    criticalFailures.push(specialtyResult.details);
  }

  const stateResult = checkStateRequirement(check.state, payer);
  results.push(stateResult);
  if (stateResult.status === 'FAIL') {
    criticalFailures.push(stateResult.details);
  }

  const npdbResult = await checkNpdbStatus(check.clinicianDid);
  results.push(npdbResult);
  if (npdbResult.status === 'FAIL' && npdbResult.severity === 'critical') {
    criticalFailures.push(npdbResult.details);
  } else if (npdbResult.status === 'WARNING') {
    warnings.push(npdbResult.details);
  }

  if (check.psvResult) {
    const psvRequirement = checkPsvRequirement(check.psvResult);
    results.push(psvRequirement);
    if (psvRequirement.status === 'FAIL' && psvRequirement.severity === 'critical') {
      criticalFailures.push(psvRequirement.details);
    } else if (psvRequirement.status === 'FAIL' || psvRequirement.status === 'WARNING') {
      warnings.push(psvRequirement.details);
    }
  }

  if (normalizedCaqh) {
    const licenseResult = checkActiveLicenses(normalizedCaqh, check.state);
    results.push(licenseResult);
    if (licenseResult.status === 'FAIL') {
      criticalFailures.push(licenseResult.details);
    }

    const malpracticeResult = checkMalpracticeInsurance(normalizedCaqh);
    results.push(malpracticeResult);
    if (malpracticeResult.status === 'FAIL') {
      warnings.push(malpracticeResult.details);
    }

    if (requiresBoardCertification(payer)) {
      const boardCertResult = checkBoardCertification(normalizedCaqh, check.specialty);
      results.push(boardCertResult);
      if (boardCertResult.status === 'FAIL') {
        warnings.push(boardCertResult.details);
      }
    }
  }

  if (check.payerRequirements?.length) {
    const templateResults = evaluateTemplateRequirements(check.payerRequirements, {
      caqh: normalizedCaqh,
      pecosStatus: check.pecosStatus,
      clinicianProfile: check.clinicianProfile,
      targetState: check.state,
    });

    for (const templateResult of templateResults) {
      results.push(templateResult);
      if (templateResult.status === 'FAIL' && templateResult.severity === 'critical') {
        criticalFailures.push(templateResult.details);
      } else if (templateResult.status === 'FAIL' || templateResult.status === 'WARNING') {
        warnings.push(templateResult.details);
      }
    }
  }

  const hasCriticalFailures = criticalFailures.length > 0;
  const hasFailures = results.some((r) => r.status === 'FAIL');
  const hasWarnings = warnings.length > 0;

  let overallStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  if (hasCriticalFailures || hasFailures) {
    overallStatus = 'FAIL';
  } else if (hasWarnings) {
    overallStatus = 'WARNING';
  }

  return {
    overallStatus,
    eligibleForEnrollment: !hasCriticalFailures && !hasFailures,
    results,
    criticalFailures,
    warnings,
    timestamp: new Date(),
  };
}

function checkCaqhRequirement(caqhData?: NormalizedCaqhData | null): RequirementResult {
  if (!caqhData) {
    return {
      requirement: 'CAQH ProView Profile',
      status: 'FAIL',
      details: 'CAQH profile is required but not provided',
      severity: 'critical',
      source: 'system',
    };
  }

  if (caqhData.status && caqhData.status !== 'Active') {
    return {
      requirement: 'CAQH ProView Profile',
      status: 'FAIL',
      details: `CAQH profile status is ${caqhData.status}, must be Active`,
      severity: 'critical',
      source: 'system',
    };
  }

  if (caqhData.attestationDate) {
    const attestationDate = new Date(caqhData.attestationDate);
    const daysSinceAttestation =
      (Date.now() - attestationDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAttestation > 120) {
      return {
        requirement: 'CAQH ProView Profile',
        status: 'WARNING',
      details: `CAQH attestation is ${Math.floor(daysSinceAttestation)} days old (>120 days)`,
        severity: 'medium',
        source: 'system',
        nextAction: 'Re-attest CAQH profile to keep it current',
      };
    }
  }

  return {
    requirement: 'CAQH ProView Profile',
    status: 'PASS',
    details: 'CAQH profile is active and current',
    source: 'system',
  };
}

function checkPecosRequirement(pecosStatus?: PecosEnrollmentStatus): RequirementResult {
  if (!pecosStatus) {
    return {
      requirement: 'PECOS Enrollment',
      status: 'FAIL',
      details: 'PECOS enrollment is required but not found',
      severity: 'critical',
      source: 'system',
    };
  }

  if (pecosStatus.status !== 'APPROVED') {
    return {
      requirement: 'PECOS Enrollment',
      status: 'FAIL',
      details: `PECOS status is ${pecosStatus.status}, must be APPROVED`,
      severity: 'critical',
      source: 'system',
    };
  }

  if (pecosStatus.revalidationDueDate) {
    const revalidationDue = new Date(pecosStatus.revalidationDueDate);
    if (revalidationDue < new Date()) {
      return {
        requirement: 'PECOS Enrollment',
        status: 'FAIL',
        details: 'PECOS revalidation is overdue',
        severity: 'critical',
        source: 'system',
      };
    }

    const daysUntilRevalidation =
      (revalidationDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilRevalidation <= 90) {
      return {
        requirement: 'PECOS Enrollment',
        status: 'WARNING',
        details: `PECOS revalidation due in ${Math.floor(daysUntilRevalidation)} days`,
        severity: 'medium',
        source: 'system',
      };
    }
  }

  return {
    requirement: 'PECOS Enrollment',
    status: 'PASS',
    details: 'PECOS enrollment is active and current',
    source: 'system',
  };
}

function checkSpecialtyRequirement(specialty: string, payer: PayerRecord): RequirementResult {
  if (payer.specialty.length === 0) {
    return {
      requirement: 'Specialty Match',
      status: 'PASS',
      details: 'Payer accepts all specialties',
      source: 'system',
    };
  }

  if (payer.specialty.includes(specialty)) {
    return {
      requirement: 'Specialty Match',
      status: 'PASS',
      details: `Specialty ${specialty} is accepted by payer`,
      source: 'system',
    };
  }

  return {
    requirement: 'Specialty Match',
    status: 'FAIL',
    details: `Specialty ${specialty} is not accepted by this payer`,
    severity: 'critical',
    source: 'system',
  };
}

function checkStateRequirement(state: string, payer: PayerRecord): RequirementResult {
  if (payer.states.length === 0 || payer.states.includes('ALL')) {
    return {
      requirement: 'State Coverage',
      status: 'PASS',
      details: 'Payer operates nationwide',
      source: 'system',
    };
  }

  if (payer.states.includes(state.toUpperCase())) {
    return {
      requirement: 'State Coverage',
      status: 'PASS',
      details: `Payer operates in ${state}`,
      source: 'system',
    };
  }

  return {
    requirement: 'State Coverage',
    status: 'FAIL',
    details: `Payer does not operate in ${state}`,
    severity: 'critical',
    source: 'system',
  };
}

async function checkNpdbStatus(clinicianDid: string): Promise<RequirementResult> {
  try {
    const npdbRecord = await prisma.npdbOigMonitor.findFirst({
      where: {
        clinicianDid,
        monitorType: 'NPDB',
      },
      orderBy: {
        checkDate: 'desc',
      },
    });

    if (!npdbRecord) {
      return {
        requirement: 'NPDB Check',
        status: 'WARNING',
        details: 'No NPDB check found, verification recommended',
        severity: 'medium',
        source: 'system',
      };
    }

    if (npdbRecord.status === 'CLEAN') {
      return {
        requirement: 'NPDB Check',
        status: 'PASS',
        details: `NPDB check passed (last checked: ${npdbRecord.checkDate.toLocaleDateString()})`,
        source: 'system',
      };
    }

    if (npdbRecord.status === 'ADVERSE_ACTION') {
      return {
        requirement: 'NPDB Check',
        status: 'FAIL',
        details: 'NPDB adverse action found',
        severity: 'critical',
        source: 'system',
        nextAction: 'Escalate to credentialing team for remediation',
      };
    }

    return {
      requirement: 'NPDB Check',
      status: 'WARNING',
      details: `NPDB check status: ${npdbRecord.status}`,
      severity: 'high',
      source: 'system',
    };
  } catch (error) {
    return {
      requirement: 'NPDB Check',
      status: 'WARNING',
      details: 'Unable to verify NPDB status',
      severity: 'medium',
      source: 'system',
    };
  }
}

function checkPsvRequirement(psv: PsvResultSummary): RequirementResult {
  if (psv.overallStatus === 'PASS') {
    return {
      requirement: 'PSV Freshness',
      status: 'PASS',
      details: `PSV check passed on ${new Date(psv.checkedAt).toLocaleDateString()}`,
      source: 'system',
    };
  }

  if (psv.overallStatus === 'WARNING') {
    return {
      requirement: 'PSV Freshness',
      status: 'WARNING',
      details: 'PSV validation is older than 120 days or pending follow-up',
      severity: 'medium',
      source: 'system',
      nextAction: 'Re-run PSV checks to maintain NCQA freshness requirements',
    };
  }

  return {
    requirement: 'PSV Freshness',
    status: 'FAIL',
    details: 'PSV results indicate outstanding issues that must be resolved',
    severity: 'critical',
    source: 'system',
    nextAction: 'Resolve PSV failures and upload evidence before proceeding',
  };
}


function checkActiveLicenses(caqhData: NormalizedCaqhData | null, state: string): RequirementResult {
  if (!caqhData) {
    return {
      requirement: 'Active Medical License',
      status: 'FAIL',
      details: 'No CAQH license data available',
      severity: 'critical',
      source: 'system',
    };
  }

  const activeLicenses = caqhData.licenses.filter(
    (lic) => lic.status === 'Active' && new Date(lic.expirationDate) > new Date()
  );

  if (activeLicenses.length === 0) {
    return {
      requirement: 'Active Medical License',
      status: 'FAIL',
      details: 'No active medical licenses found',
      severity: 'critical',
      source: 'system',
    };
  }

  const stateLicense = activeLicenses.find((lic) => lic.state === state.toUpperCase());
  if (stateLicense) {
    return {
      requirement: 'Active Medical License',
      status: 'PASS',
      details: `Active ${stateLicense.licenseType} license in ${state} (expires: ${new Date(
        stateLicense.expirationDate
      ).toLocaleDateString()})`,
      source: 'system',
    };
  }

  return {
    requirement: 'Active Medical License',
    status: 'PASS',
    details: `${activeLicenses.length} active license(s) found (none in ${state})`,
    source: 'system',
  };
}

function checkMalpracticeInsurance(caqhData: NormalizedCaqhData | null): RequirementResult {
  if (!caqhData || !caqhData.malpractice) {
    return {
      requirement: 'Malpractice Insurance',
      status: 'FAIL',
      details: 'Malpractice insurance information not found',
      severity: 'high',
      source: 'system',
    };
  }

  const expirationDate = new Date(caqhData.malpractice.expirationDate);
  if (expirationDate < new Date()) {
    return {
      requirement: 'Malpractice Insurance',
      status: 'FAIL',
      details: 'Malpractice insurance has expired',
      severity: 'high',
      source: 'system',
      nextAction: 'Upload current malpractice certificate to CAQH',
    };
  }

  if (caqhData.malpractice.coverageAmount < 1000000) {
    return {
      requirement: 'Malpractice Insurance',
      status: 'WARNING',
      details: `Coverage amount ($${caqhData.malpractice.coverageAmount.toLocaleString()}) below typical minimum`,
      severity: 'medium',
      source: 'system',
    };
  }

  return {
    requirement: 'Malpractice Insurance',
    status: 'PASS',
    details: `Active malpractice insurance (${caqhData.malpractice.carrier}, $${caqhData.malpractice.coverageAmount.toLocaleString()})`,
    source: 'system',
  };
}

function checkBoardCertification(
  caqhData: NormalizedCaqhData | null,
  specialty: string
): RequirementResult {
  if (!caqhData) {
    return {
      requirement: 'Board Certification',
      status: 'WARNING',
      details: 'No board certification data available',
      severity: 'medium',
      source: 'system',
    };
  }

  if (caqhData.boardCertifications.length === 0) {
    return {
      requirement: 'Board Certification',
      status: 'WARNING',
      details: 'No board certifications found',
      severity: 'medium',
      source: 'system',
    };
  }

  const activeCerts = caqhData.boardCertifications.filter(
    (cert) => cert.status === 'Active' && new Date(cert.expirationDate) > new Date()
  );

  if (activeCerts.length === 0) {
    return {
      requirement: 'Board Certification',
      status: 'WARNING',
      details: 'No active board certifications found',
      severity: 'medium',
      source: 'system',
    };
  }

  return {
    requirement: 'Board Certification',
    status: 'PASS',
    details: `${activeCerts.length} active board certification(s) found`,
    source: 'system',
  };
}

function requiresBoardCertification(payer: PayerRecord): boolean {
  return ['CMS_MEDICARE', 'KAISER', 'ANTHEM'].includes(payer.payerId);
}

function evaluateTemplateRequirements(
  definitions: RequirementDefinition[],
  context: TemplateRequirementContext
): RequirementResult[] {
  return definitions.map((definition) => evaluateTemplateRequirement(definition, context));
}

function evaluateTemplateRequirement(
  definition: RequirementDefinition,
  context: TemplateRequirementContext
): RequirementResult {
  switch (definition.type) {
    case 'STATE_LICENSE':
      return evaluateStateLicenseRequirement(definition, context);
    case 'DEA_REGISTRATION':
      return evaluateDeaRequirement(definition, context);
    case 'BOARD_CERTIFICATION':
      return evaluateBoardRequirement(definition, context);
    case 'PECOS_ENROLLMENT':
      return evaluatePecosTemplateRequirement(definition, context);
    case 'MALPRACTICE':
      return evaluateMalpracticeRequirement(definition, context);
    default:
      return {
        requirement: definition.label,
        status: 'NOT_APPLICABLE',
        details: 'Requirement type not recognised',
        severity: definition.severity,
        source: 'template',
      };
  }
}

function evaluateStateLicenseRequirement(
  definition: RequirementDefinition,
  context: TemplateRequirementContext
): RequirementResult {
  const targetState =
    (definition.metadata?.state as string | undefined)?.toUpperCase() ||
    context.targetState.toUpperCase();
  const failStatus = definition.optional ? 'WARNING' : 'FAIL';

  if (!context.caqh) {
    return {
      requirement: definition.label,
      status: failStatus,
      details: 'State license data unavailable',
      severity: definition.severity,
      source: 'template',
      nextAction: definition.nextAction || 'Sync CAQH profile to evaluate state licenses',
    };
  }

  const hasStateLicense = context.caqh.licenses.some(
    (lic) =>
      lic.state === targetState &&
      lic.status === 'Active' &&
      new Date(lic.expirationDate) > new Date()
  );

  if (hasStateLicense) {
    return {
      requirement: definition.label,
      status: 'PASS',
      details: `Active license found in ${targetState}`,
      severity: definition.severity,
      source: 'template',
    };
  }

  return {
    requirement: definition.label,
    status: failStatus,
    details: `No active license found in ${targetState}`,
    severity: definition.severity,
    source: 'template',
    nextAction:
      definition.nextAction || `Add ${targetState} license to CAQH or upload supporting docs`,
  };
}

function evaluateDeaRequirement(
  definition: RequirementDefinition,
  context: TemplateRequirementContext
): RequirementResult {
  const failStatus = definition.optional ? 'WARNING' : 'FAIL';
  const deaLicense = context.caqh?.licenses.find(
    (lic) =>
      lic.licenseType.toUpperCase().includes('DEA') &&
      lic.status === 'Active' &&
      new Date(lic.expirationDate) > new Date()
  );

  if (deaLicense) {
    return {
      requirement: definition.label,
      status: 'PASS',
      details: `DEA registration active (expires ${new Date(
        deaLicense.expirationDate
      ).toLocaleDateString()})`,
      severity: definition.severity,
      source: 'template',
    };
  }

  return {
    requirement: definition.label,
    status: failStatus,
    details: 'DEA registration not found or expired',
    severity: definition.severity,
    source: 'template',
    nextAction: definition.nextAction || 'Upload DEA certificate to CAQH / renewal portal',
  };
}

function evaluateBoardRequirement(
  definition: RequirementDefinition,
  context: TemplateRequirementContext
): RequirementResult {
  const failStatus = definition.optional ? 'WARNING' : 'FAIL';
  const targetSpecialty =
    (definition.metadata?.specialty as string | undefined) ||
    context.clinicianProfile?.specialty;

  if (!context.caqh) {
    return {
      requirement: definition.label,
      status: failStatus,
      details: 'Board certification data unavailable',
      severity: definition.severity,
      source: 'template',
      nextAction: definition.nextAction || 'Sync CAQH profile to refresh board certifications',
    };
  }

  const hasActiveBoard = context.caqh.boardCertifications.some((cert) => {
    const matchesSpecialty = targetSpecialty
      ? cert.specialty.toLowerCase() === targetSpecialty.toLowerCase()
      : true;
    return (
      cert.status === 'Active' &&
      new Date(cert.expirationDate) > new Date() &&
      matchesSpecialty
    );
  });

  if (hasActiveBoard) {
    return {
      requirement: definition.label,
      status: 'PASS',
      details: 'Active board certification on file',
      severity: definition.severity,
      source: 'template',
    };
  }

  return {
    requirement: definition.label,
    status: failStatus,
    details: targetSpecialty
      ? `Board certification for ${targetSpecialty} not found or expired`
      : 'Board certification not found or expired',
    severity: definition.severity,
    source: 'template',
    nextAction: definition.nextAction || 'Upload current board certification to CAQH',
  };
}

function evaluatePecosTemplateRequirement(
  definition: RequirementDefinition,
  context: TemplateRequirementContext
): RequirementResult {
  const failStatus = definition.optional ? 'WARNING' : 'FAIL';
  if (context.pecosStatus?.status === 'APPROVED') {
    return {
      requirement: definition.label,
      status: 'PASS',
      details: 'PECOS enrollment approved',
      severity: definition.severity,
      source: 'template',
    };
  }

  return {
    requirement: definition.label,
    status: failStatus,
    details: 'PECOS approval not on file',
    severity: definition.severity,
    source: 'template',
    nextAction: definition.nextAction || 'Upload PECOS confirmation letter or screenshot',
  };
}

function evaluateMalpracticeRequirement(
  definition: RequirementDefinition,
  context: TemplateRequirementContext
): RequirementResult {
  const failStatus = definition.optional ? 'WARNING' : 'FAIL';
  const minCoverage = Number(definition.metadata?.minCoverage ?? 1000000);
  const malpractice = context.caqh?.malpractice;

  if (!malpractice) {
    return {
      requirement: definition.label,
      status: failStatus,
      details: 'Malpractice policy not found',
      severity: definition.severity,
      source: 'template',
      nextAction: definition.nextAction || 'Add malpractice policy details to CAQH',
    };
  }

  const expired = new Date(malpractice.expirationDate) < new Date();
  if (expired || malpractice.coverageAmount < minCoverage) {
    return {
      requirement: definition.label,
      status: failStatus,
      details: expired
        ? 'Malpractice policy expired'
        : `Coverage $${malpractice.coverageAmount.toLocaleString()} < required $${minCoverage.toLocaleString()}`,
      severity: definition.severity,
      source: 'template',
      nextAction: definition.nextAction || 'Upload updated malpractice certificate',
    };
  }

  return {
    requirement: definition.label,
    status: 'PASS',
    details: `Coverage $${malpractice.coverageAmount.toLocaleString()} valid through ${new Date(
      malpractice.expirationDate
    ).toLocaleDateString()}`,
    severity: definition.severity,
    source: 'template',
  };
}

function normalizeCaqhData(
  caqhProfile?: CaqhProfile,
  caqhFields?: CaqhProfileFields
): NormalizedCaqhData | null {
  if (caqhFields) {
    return {
      caqhId: caqhFields.caqhId,
      status: caqhFields.status,
      attestationDate: caqhFields.attestationDate,
      expirationDate: caqhFields.expirationDate,
      lastUpdatedAt: caqhFields.lastUpdatedAt,
      licenses: caqhFields.licenses,
      boardCertifications: caqhFields.boardCertifications,
      malpractice: caqhFields.malpractice ?? null,
    };
  }

  if (caqhProfile) {
    return {
      caqhId: caqhProfile.caqhId,
      status: caqhProfile.status,
      attestationDate: caqhProfile.attestationDate,
      expirationDate: caqhProfile.expirationDate,
      lastUpdatedAt: caqhProfile.lastUpdateDate,
      licenses: caqhProfile.profile.licenses,
      boardCertifications: caqhProfile.profile.boardCertifications,
      malpractice: caqhProfile.profile.malpracticeInsurance
        ? { ...caqhProfile.profile.malpracticeInsurance }
        : null,
    };
  }

  return null;
}

function caqResultIsCriticalFailure(result: RequirementResult): boolean {
  return result.status === 'FAIL' && result.severity === 'critical';
}

function caqResultIsWarning(result: RequirementResult): boolean {
  return result.status === 'WARNING';
}

export function getRequirementsSummary(result: EnrollmentRequirementsResult): string {
  if (result.eligibleForEnrollment) {
    return result.warnings.length > 0
      ? `Eligible with ${result.warnings.length} warning(s)`
      : 'Eligible for enrollment';
  }

  return `Not eligible: ${result.criticalFailures.join('; ')}`;
}
