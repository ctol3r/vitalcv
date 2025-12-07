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

    const procedure: PrivilegeProcedureResource = PrivilegeProcedureProfile.parse({
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

    return procedure;
  });
}
/**
 * B170A-PRIV-005: PrivilegeSet → FHIR Procedure mapping
 *
 * Converts privilege matrix entries into FHIR Procedure resources that can be
 * used for interoperability reporting.
 */

import type { PrivilegeMatrixEntry } from '../../privileging/models/PrivilegeMatrix';

export interface FHIRProcedureCode {
  system: string;
  code: string;
  display: string;
}

export interface FHIRProcedure {
  resourceType: 'Procedure';
  id: string;
  status: 'completed' | 'unknown';
  code: {
    coding: FHIRProcedureCode[];
    text: string;
  };
  performedDateTime: string;
  note?: Array<{
    text: string;
  }>;
  performer?: Array<{
    actor: {
      reference: string;
      display?: string;
    };
  }>;
}

const PRIVILEGE_CODE_SYSTEM = 'https://vitalcv.dev/fhir/CodeSystem/privilege-matrix';

export function privilegeToProcedureCode(privilege: PrivilegeMatrixEntry): FHIRProcedureCode {
  return {
    system: PRIVILEGE_CODE_SYSTEM,
    code: privilege.privilegeCode,
    display: privilege.name,
  };
}

export function mapPrivilegeSetToFHIRProcedures(options: {
  privileges: PrivilegeMatrixEntry[];
  performerReference?: string;
}): FHIRProcedure[] {
  const { privileges, performerReference } = options;
  const now = new Date().toISOString();

  return privileges.map((privilege) => ({
    resourceType: 'Procedure' as const,
    id: `priv-${privilege.privilegeCode}`,
    status: 'completed',
    code: {
      coding: [privilegeToProcedureCode(privilege)],
      text: privilege.name,
    },
    performedDateTime: now,
    note: privilege.prerequisites.length
      ? [
          {
            text: `Prerequisites: ${privilege.prerequisites.map((p) => p.type).join(', ')}`,
          },
        ]
      : undefined,
    performer: performerReference
      ? [
          {
            actor: {
              reference: performerReference,
            },
          },
        ]
      : undefined,
  }));
}


