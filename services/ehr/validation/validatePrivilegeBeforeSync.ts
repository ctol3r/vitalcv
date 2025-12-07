import type { PrivilegeMatrixEntry } from '../../privileging/models/PrivilegeMatrix';
import type { ClinicianSnapshot } from '../../privileging/validators/validatePrivilegeRequest';
import { validatePrivilegeRequest } from '../../privileging/validators/validatePrivilegeRequest';

export type BlockingPrerequisiteType = 'BOARD_CERT' | 'LICENSE_STATUS' | 'DEA_REGISTRATION';

export interface PrivilegeSyncValidationOptions {
  privilegeCodes: string[];
  privileges: PrivilegeMatrixEntry[];
  clinician: ClinicianSnapshot;
  privilegeSetSpecialty?: string;
}

export interface PrivilegeSyncValidationIssue {
  privilegeCode: string;
  prerequisiteType: BlockingPrerequisiteType;
  reason: string;
}

export interface PrivilegeSyncValidationResult {
  ok: boolean;
  blockingIssues: PrivilegeSyncValidationIssue[];
  warnings: string[];
}

const BLOCKING_TYPES: BlockingPrerequisiteType[] = ['BOARD_CERT', 'LICENSE_STATUS', 'DEA_REGISTRATION'];

export function validatePrivilegeBeforeSync(options: PrivilegeSyncValidationOptions): PrivilegeSyncValidationResult {
  const result = validatePrivilegeRequest({
    privilegeSetSpecialty: options.privilegeSetSpecialty ?? 'General',
    privilegeCodes: options.privilegeCodes,
    privileges: options.privileges,
    clinician: options.clinician,
  });

  const blockingIssues: PrivilegeSyncValidationIssue[] = result.failed
    .filter((failure) => BLOCKING_TYPES.includes(failure.prerequisite.type as BlockingPrerequisiteType))
    .map((failure) => ({
      privilegeCode: failure.privilegeCode,
      prerequisiteType: failure.prerequisite.type as BlockingPrerequisiteType,
      reason: failure.reason,
    }));

  const warnings = [...result.warnings];
  if (!result.matchedSpecialty) {
    warnings.push('Clinician specialty does not match privilege set specialty');
  }

  return {
    ok: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  };
}
