/**
 * B170A-PRIV-004: Privilege request validator
 *
 * Evaluates clinician evidence against PrivilegeMatrix prerequisites and
 * ensures specialty alignment before allowing a privilege request to proceed.
 */

import type { PrivilegeMatrixEntry, PrivilegePrerequisite } from '../models/PrivilegeMatrix';

export interface BoardCertificationRecord {
  board: string;
  specialty: string;
  certifiedAt: string;
  expiresAt?: string;
}

export interface LicenseRecord {
  state: string;
  status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'PROBATION' | 'EXPIRED';
  expiresAt: string;
}

export interface ProcedureVolumeRecord {
  procedureName: string;
  count: number;
  lookbackMonths: number;
  includesAssists?: boolean;
}

export interface DeaRegistrationRecord {
  number: string;
  schedules: string[];
  expiresAt?: string;
}

export interface ClinicianSnapshot {
  clinicianDid: string;
  specialty: string;
  subspecialties?: string[];
  boardCertifications?: BoardCertificationRecord[];
  licenses?: LicenseRecord[];
  deaRegistrations?: DeaRegistrationRecord[];
  procedureVolumes?: ProcedureVolumeRecord[];
  customAttributes?: Record<string, string | number | boolean | Array<string | number>>;
}

export interface PrivilegeRequestValidationResult {
  valid: boolean;
  matchedSpecialty: boolean;
  failed: Array<{
    privilegeCode: string;
    prerequisite: PrivilegePrerequisite;
    reason: string;
  }>;
  warnings: string[];
}

interface ValidatePrivilegeRequestOptions {
  privilegeSetSpecialty: string;
  privilegeCodes: string[];
  privileges: PrivilegeMatrixEntry[];
  clinician: ClinicianSnapshot;
}

export function validatePrivilegeRequest(options: ValidatePrivilegeRequestOptions): PrivilegeRequestValidationResult {
  const { privilegeSetSpecialty, privilegeCodes, privileges, clinician } = options;

  const normalizedCodes = privilegeCodes.map((code) => code.toUpperCase());
  const privilegeMap = new Map(privileges.map((priv) => [priv.privilegeCode, priv]));

  const failed: PrivilegeRequestValidationResult['failed'] = [];
  const warnings: string[] = [];

  const matchedSpecialty = matchSpecialty(privilegeSetSpecialty, clinician);

  if (!matchedSpecialty) {
    warnings.push(`Clinician specialty ${clinician.specialty} does not match privilege set specialty ${privilegeSetSpecialty}`);
  }

  for (const code of normalizedCodes) {
    const privilege = privilegeMap.get(code);

    if (!privilege) {
      failed.push({
        privilegeCode: code,
        prerequisite: {
          type: 'CUSTOM',
          key: 'privilegeCode',
          operator: 'IN',
          value: [],
        },
        reason: `Privilege code ${code} is not part of the matrix`,
      });
      continue;
    }

    for (const prerequisite of privilege.prerequisites) {
      const prerequisiteResult = evaluatePrerequisite(prerequisite, clinician, privilege.specialty ?? privilegeSetSpecialty);
      if (!prerequisiteResult.passed) {
        failed.push({
          privilegeCode: code,
          prerequisite,
          reason: prerequisiteResult.reason,
        });
      } else if (prerequisiteResult.warning) {
        warnings.push(prerequisiteResult.warning);
      }
    }
  }

  return {
    valid: failed.length === 0 && matchedSpecialty,
    matchedSpecialty,
    failed,
    warnings,
  };
}

function evaluatePrerequisite(
  prerequisite: PrivilegePrerequisite,
  clinician: ClinicianSnapshot,
  privilegeSpecialty: string
): { passed: boolean; reason: string; warning?: string } {
  switch (prerequisite.type) {
    case 'BOARD_CERT':
      return checkBoardCertification(prerequisite, clinician.boardCertifications ?? []);
    case 'LICENSE_STATUS':
      return checkLicense(prerequisite, clinician.licenses ?? []);
    case 'PROCEDURE_VOLUME':
      return checkProcedureVolume(prerequisite, clinician.procedureVolumes ?? []);
    case 'DEA_REGISTRATION':
      return checkDeaRegistration(prerequisite, clinician.deaRegistrations ?? []);
    case 'SPECIALTY_MATCH':
      return {
        passed: matchSpecialty(prerequisite.allowedSpecialties[0] ?? privilegeSpecialty, clinician, prerequisite.allowedSpecialties),
        reason: `Clinician specialty must match one of: ${prerequisite.allowedSpecialties.join(', ')}`,
      };
    case 'CUSTOM':
      return checkCustomAttribute(prerequisite, clinician.customAttributes ?? {});
    default:
      return { passed: true, reason: 'Unknown prerequisite type' };
  }
}

function matchSpecialty(
  requiredSpecialty: string,
  clinician: ClinicianSnapshot,
  allowedSpecialties?: string[]
) {
  const matchesDirect = clinician.specialty.toLowerCase() === requiredSpecialty.toLowerCase();
  if (matchesDirect) return true;

  const allowed = allowedSpecialties || [requiredSpecialty];
  const clinicianSpecialties = [clinician.specialty, ...(clinician.subspecialties ?? [])].map((spec) =>
    spec.toLowerCase()
  );

  return allowed.some((spec) => clinicianSpecialties.some((c) => c.startsWith(spec.toLowerCase())));
}

function checkBoardCertification(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'BOARD_CERT' }>,
  certifications: BoardCertificationRecord[]
) {
  const now = new Date();
  const bufferMonths = prerequisite.expirationBufferMonths ?? 0;
  const bufferMs = bufferMonths * 30 * 24 * 60 * 60 * 1000;

  const match = certifications.find((cert) => {
    const boardMatch = prerequisite.boards.some((board) => cert.board.toLowerCase().includes(board.toLowerCase()));
    if (!boardMatch) return false;

    if (prerequisite.specialties.length > 0) {
      const specialtyMatch = prerequisite.specialties.some((spec) =>
        cert.specialty.toLowerCase().includes(spec.toLowerCase())
      );
      if (!specialtyMatch) return false;
    }

    if (!cert.expiresAt) return true;

    const expires = new Date(cert.expiresAt);
    return expires.getTime() - bufferMs > now.getTime();
  });

  return match
    ? { passed: true, reason: 'Board certification requirement satisfied' }
    : {
        passed: false,
        reason: `Board certification with ${prerequisite.boards.join(', ')} is required`,
      };
}

function checkLicense(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'LICENSE_STATUS' }>,
  licenses: LicenseRecord[]
) {
  if (licenses.length === 0) {
    return { passed: false, reason: 'No licenses provided' };
  }

  const now = new Date();

  const hasRequiredLicense = licenses.some((license) => {
    if (license.status === 'EXPIRED') return false;
    if (license.status === 'SUSPENDED' || license.status === 'RESTRICTED') {
      return prerequisite.status === 'ACTIVE' ? false : prerequisite.allowProbation;
    }
    if (license.status === 'PROBATION' && !prerequisite.allowProbation) {
      return false;
    }

    if (license.expiresAt && new Date(license.expiresAt) <= now) {
      return false;
    }

    if (prerequisite.states.length === 0) return true;
    return prerequisite.states.includes(license.state.toUpperCase());
  });

  return hasRequiredLicense
    ? { passed: true, reason: 'License requirement satisfied' }
    : {
        passed: false,
        reason:
          prerequisite.states.length > 0
            ? `Active license required in: ${prerequisite.states.join(', ')}`
            : 'Active unrestricted license required',
      };
}

function checkProcedureVolume(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'PROCEDURE_VOLUME' }>,
  volumes: ProcedureVolumeRecord[]
) {
  const record = volumes.find(
    (volume) =>
      volume.procedureName.toLowerCase() === prerequisite.procedureName.toLowerCase() &&
      volume.lookbackMonths <= prerequisite.lookbackMonths + 1
  );

  if (!record) {
    return {
      passed: false,
      reason: `No cases recorded for ${prerequisite.procedureName} within ${prerequisite.lookbackMonths} months`,
    };
  }

  if (record.count < prerequisite.minProcedures) {
    return {
      passed: false,
      reason: `Minimum ${prerequisite.minProcedures} ${prerequisite.procedureName} cases required`,
    };
  }

  return { passed: true, reason: 'Procedure volume requirement satisfied' };
}

function checkDeaRegistration(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'DEA_REGISTRATION' }>,
  registrations: DeaRegistrationRecord[]
) {
  if (registrations.length === 0) {
    return { passed: false, reason: 'DEA registration required' };
  }

  const hasSchedule = registrations.some((registration) => {
    if (registration.expiresAt && new Date(registration.expiresAt) <= new Date()) {
      return false;
    }
    return prerequisite.schedules.every((schedule) =>
      registration.schedules.map((s) => s.toUpperCase()).includes(schedule.toUpperCase())
    );
  });

  return hasSchedule
    ? { passed: true, reason: 'DEA registration requirement satisfied' }
    : {
        passed: false,
        reason: `DEA registration covering schedules ${prerequisite.schedules.join(', ')} is required`,
      };
}

function checkCustomAttribute(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'CUSTOM' }>,
  customAttributes: ClinicianSnapshot['customAttributes']
) {
  const value = customAttributes[prerequisite.key];
  if (value === undefined) {
    return { passed: false, reason: `Missing custom attribute ${prerequisite.key}` };
  }

  switch (prerequisite.operator) {
    case 'EQUALS':
      return {
        passed: value === prerequisite.value,
        reason: `Attribute ${prerequisite.key} must equal ${prerequisite.value}`,
      };
    case 'GTE':
      return {
        passed: Number(value) >= Number(prerequisite.value),
        reason: `Attribute ${prerequisite.key} must be ≥ ${prerequisite.value}`,
      };
    case 'LTE':
      return {
        passed: Number(value) <= Number(prerequisite.value),
        reason: `Attribute ${prerequisite.key} must be ≤ ${prerequisite.value}`,
      };
    case 'IN': {
      const list = Array.isArray(prerequisite.value) ? prerequisite.value : [prerequisite.value];
      const present = Array.isArray(value)
        ? value.some((v) => list.includes(v))
        : list.includes(value);
      return {
        passed: present,
        reason: `Attribute ${prerequisite.key} must match one of ${list.join(', ')}`,
      };
    }
    default:
      return { passed: true, reason: 'Custom attribute validated' };
  }
}


