import type { PrivilegeMatrixEntry } from '../../privileging/models/PrivilegeMatrix';
import { describePrerequisite, normalizePrivilegeCode } from '../../privileging/models/PrivilegeMatrix';
import {
  PRIVILEGE_CODE_SYSTEM,
  PRIVILEGE_METADATA_EXTENSION_URL,
  PrivilegeProcedureProfile,
  type PrivilegeProcedureResource,
} from '../../../packages/domain-provider/fhir/privilegeProcedureProfile';

export interface MapPrivilegeSetOptions {
  privileges: PrivilegeMatrixEntry[];
  performerReference: string;
  subjectReference?: string;
  encounterReference?: string;
  status?: 'preparation' | 'in-progress' | 'completed';
}

export function privilegeToProcedureCode(privilege: PrivilegeMatrixEntry) {
  return {
    system: PRIVILEGE_CODE_SYSTEM,
    code: normalizePrivilegeCode(privilege.privilegeCode),
    display: privilege.name,
    extension: privilege.prerequisites?.length
      ? [
          {
            url: PRIVILEGE_METADATA_EXTENSION_URL,
            valueString: privilege.prerequisites.map((p) => describePrerequisite(p)).join('; '),
          },
        ]
      : undefined,
  };
}

export function mapPrivilegeSetToFHIRProcedures(options: MapPrivilegeSetOptions): PrivilegeProcedureResource[] {
  const subjectReference = options.subjectReference ?? options.performerReference;
  const status = options.status ?? 'completed';

  return options.privileges.map((privilege) => {
    const prerequisites = privilege.prerequisites?.map((p) => describePrerequisite(p)) ?? [];

    return PrivilegeProcedureProfile.parse({
      resourceType: 'Procedure',
      status,
      code: {
        coding: [privilegeToProcedureCode(privilege)],
        text: privilege.name,
      },
      subject: {
        reference: subjectReference,
      },
      encounter: options.encounterReference
        ? {
            reference: options.encounterReference,
          }
        : undefined,
      performer: [
        {
          actor: {
            reference: options.performerReference,
            display: privilege.name,
          },
        },
      ],
      note: prerequisites.length
        ? [
            {
              text: `Prerequisites: ${prerequisites.join('; ')}`,
            },
          ]
        : undefined,
    });
  });
}
