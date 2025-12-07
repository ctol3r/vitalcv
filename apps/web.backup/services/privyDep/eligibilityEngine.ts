import { buildPrivilegeGraph } from './graph';
import { buildClinicianPrivilegeSnapshot, ClinicianPrivilegeSnapshot } from './clinicianSnapshot';
import { PrivilegePrerequisite, normalizePrivilegeCode } from './types';
import { emitPrivilegeGraphChange } from './events/emitter';
import { CredentialRiskFactors } from '../credentialRisk/enums';

export interface PrivilegeEligibilityInput {
  clinicianId: string;
  privilegeCode: string;
  orgId?: string;
  broadcast?: boolean;
}

export interface PrivilegeEligibilityResult {
  clinicianId: string;
  privilegeCode: string;
  eligible: boolean;
  missingPrereqs: string[];
  conflicts: string[];
  evaluatedAt: Date;
  graphDepth: number;
}

interface PrerequisiteEvaluation {
  passed: boolean;
  reason?: string;
  conflict?: string;
}

export async function evaluatePrivilegeEligibility(
  input: PrivilegeEligibilityInput
): Promise<PrivilegeEligibilityResult> {
  const normalizedCode = normalizePrivilegeCode(input.privilegeCode);
  const [snapshot, graph] = await Promise.all([
    buildClinicianPrivilegeSnapshot(input.clinicianId),
    buildPrivilegeGraph(normalizedCode, { maxDepth: 5 }),
  ]);

  const missing = new Set<string>();
  const conflicts = new Set<string>();
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();

  function evaluateNode(code: string, depth: number): boolean {
    if (memo.has(code)) {
      return memo.get(code)!;
    }
    if (visiting.has(code)) {
      return true;
    }

    visiting.add(code);
    let passed = true;

    const node = graph.nodes.get(code);
    if (!node) {
      missing.add(`Privilege ${code} is not defined in the matrix`);
      memo.set(code, false);
      visiting.delete(code);
      return false;
    }

    for (const prerequisite of node.prerequisites) {
      const evaluation = evaluatePrerequisite(prerequisite, snapshot);
      if (prerequisite.type === 'PRIVILEGE') {
        const dependencyCode = normalizePrivilegeCode(prerequisite.privilegeCode);
        const dependencySatisfied = snapshot.grantedPrivilegeCodes.has(dependencyCode);
        const dependencyEligible = evaluateNode(dependencyCode, depth + 1);
        if (!dependencySatisfied || !dependencyEligible) {
          passed = false;
          missing.add(
            prerequisite.description ??
              `Requires upstream privilege ${dependencyCode} before granting ${code}`
          );
        }
        continue;
      }

      if (!evaluation.passed) {
        passed = false;
        if (evaluation.reason) {
          missing.add(evaluation.reason);
        }
      }
      if (evaluation.conflict) {
        conflicts.add(evaluation.conflict);
      }
    }

    visiting.delete(code);
    memo.set(code, passed);
    return passed;
  }

  const eligible = evaluateNode(normalizedCode, 0) && conflicts.size === 0;
  const result: PrivilegeEligibilityResult = {
    clinicianId: snapshot.clinicianId,
    privilegeCode: normalizedCode,
    eligible,
    missingPrereqs: Array.from(missing),
    conflicts: Array.from(conflicts),
    evaluatedAt: new Date(),
    graphDepth: graph.nodes.size,
  };

  if (input.broadcast) {
    await emitPrivilegeGraphChange({
      clinicianId: snapshot.clinicianId,
      clinicianDid: snapshot.clinicianDid,
      orgId: input.orgId,
      changeType: eligible ? 'PRIVILEGE_ELIGIBLE' : 'PRIVILEGE_BLOCKED',
      privilegeCode: normalizedCode,
      reason: eligible ? 'All prerequisites satisfied' : 'Prerequisites missing',
      missingPrereqs: result.missingPrereqs,
      conflicts: result.conflicts,
      riskFactorsToAdd: eligible ? [] : [CredentialRiskFactors.PRIVILEGE_GRAPH_DRIFT],
      riskFactorsToRemove: eligible ? [CredentialRiskFactors.PRIVILEGE_GRAPH_DRIFT] : [],
      metadata: {
        evaluatedAt: result.evaluatedAt.toISOString(),
        graphDepth: result.graphDepth,
      },
    });
  }

  return result;
}

function evaluatePrerequisite(
  prerequisite: PrivilegePrerequisite,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  switch (prerequisite.type) {
    case 'BOARD_CERT':
      return checkBoardCertification(prerequisite, snapshot);
    case 'LICENSE_STATUS':
      return checkLicenseStatus(prerequisite, snapshot);
    case 'DEA_REGISTRATION':
      return checkDea(prerequisite, snapshot);
    case 'PROCEDURE_VOLUME':
      return checkProcedureVolume(prerequisite, snapshot);
    case 'SPECIALTY_MATCH':
      return checkSpecialtyMatch(prerequisite, snapshot);
    case 'CUSTOM':
      return checkCustomAttribute(prerequisite, snapshot);
    case 'CONFLICT': {
      const conflicting = prerequisite.privilegeCodes
        .map((code) => normalizePrivilegeCode(code))
        .filter((code) => snapshot.grantedPrivilegeCodes.has(code));
      if (conflicting.length > 0) {
        return {
          passed: false,
          conflict:
            prerequisite.description ??
            `Conflicts with active privileges: ${conflicting.join(', ')}`,
        };
      }
      return { passed: true };
    }
    default:
      return { passed: true };
  }
}

function checkBoardCertification(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'BOARD_CERT' }>,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  const buffer = (prerequisite.expirationBufferMonths ?? 0) * 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const match = snapshot.boardCertifications.some((cert) => {
    const boardMatch = prerequisite.boards.some((board) =>
      cert.board.toLowerCase().includes(board.toLowerCase())
    );
    if (!boardMatch) return false;
    if (prerequisite.specialties.length > 0) {
      const specialtyMatch = prerequisite.specialties.some((spec) =>
        cert.specialty.toLowerCase().includes(spec.toLowerCase())
      );
      if (!specialtyMatch) return false;
    }
    if (!cert.expiresAt) {
      return true;
    }
    const expires = new Date(cert.expiresAt).getTime();
    return expires - buffer > now;
  });

  return match
    ? { passed: true }
    : {
        passed: false,
        reason: `Board certification required from ${prerequisite.boards.join(', ')}`,
      };
}

function checkLicenseStatus(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'LICENSE_STATUS' }>,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  const license = snapshot.licenses.find((record) => {
    if (prerequisite.states.length > 0 && !prerequisite.states.includes(record.state.toUpperCase())) {
      return false;
    }
    if (record.status === 'EXPIRED' || record.status === 'SUSPENDED') {
      return false;
    }
    if (record.status === 'PROBATION' && !prerequisite.allowProbation) {
      return false;
    }
    if (record.expiresAt && new Date(record.expiresAt) <= new Date()) {
      return false;
    }
    return true;
  });

  return license
    ? { passed: true }
    : {
        passed: false,
        reason:
          prerequisite.states.length > 0
            ? `Active license required in ${prerequisite.states.join(', ')}`
            : 'Active unrestricted license required',
      };
}

function checkDea(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'DEA_REGISTRATION' }>,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  if (!snapshot.deaRegistrations.length) {
    return { passed: false, reason: 'DEA registration required' };
  }

  const match = snapshot.deaRegistrations.some((registration) => {
    if (registration.expiresAt && new Date(registration.expiresAt) <= new Date()) {
      return false;
    }
    return prerequisite.schedules.every((schedule) =>
      registration.schedules.includes(schedule.toUpperCase())
    );
  });

  return match
    ? { passed: true }
    : {
        passed: false,
        reason: `DEA schedules ${prerequisite.schedules.join(', ')} required`,
      };
}

function checkProcedureVolume(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'PROCEDURE_VOLUME' }>,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  const record = snapshot.procedureVolumes.find(
    (volume) =>
      volume.procedureName.toLowerCase() === prerequisite.procedureName.toLowerCase() &&
      volume.lookbackMonths <= prerequisite.lookbackMonths + 1
  );

  if (!record) {
    return {
      passed: false,
      reason: `No recorded procedures for ${prerequisite.procedureName} within ${prerequisite.lookbackMonths} months`,
    };
  }

  if (record.count < prerequisite.minProcedures) {
    return {
      passed: false,
      reason: `At least ${prerequisite.minProcedures} ${prerequisite.procedureName} cases required`,
    };
  }

  return { passed: true };
}

function checkSpecialtyMatch(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'SPECIALTY_MATCH' }>,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  if (!snapshot.specialty) {
    return {
      passed: false,
      reason: `Specialty match required (${prerequisite.allowedSpecialties.join(', ')})`,
    };
  }
  const matches = prerequisite.allowedSpecialties.some((spec) =>
    snapshot.specialty!.toLowerCase().startsWith(spec.toLowerCase())
  );
  return matches
    ? { passed: true }
    : {
        passed: false,
        reason: `Specialty must match one of: ${prerequisite.allowedSpecialties.join(', ')}`,
      };
}

function checkCustomAttribute(
  prerequisite: Extract<PrivilegePrerequisite, { type: 'CUSTOM' }>,
  snapshot: ClinicianPrivilegeSnapshot
): PrerequisiteEvaluation {
  const value = snapshot.customAttributes[prerequisite.key];
  if (value === undefined) {
    return {
      passed: false,
      reason: `Custom attribute ${prerequisite.key} missing`,
    };
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
      const normalizedValue = Array.isArray(value) ? value : [value];
      const match = normalizedValue.some((item) => list.includes(item));
      return {
        passed: match,
        reason: `Attribute ${prerequisite.key} must match one of ${list.join(', ')}`,
      };
    }
    default:
      return { passed: true };
  }
}

