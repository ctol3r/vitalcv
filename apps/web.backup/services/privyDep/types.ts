import type { Prisma } from '@prisma/client';

export type Primitive = string | number | boolean | null;

export type CustomOperator = 'EQUALS' | 'GTE' | 'LTE' | 'IN';

export type PrivilegeDependencyRelation = 'REQUIRES' | 'UNLOCKS';

export type PrivilegeConflictSeverity = 'info' | 'warning' | 'critical';

export type PrivilegePrerequisite =
  | {
      type: 'BOARD_CERT';
      boards: string[];
      specialties: string[];
      expirationBufferMonths?: number;
    }
  | {
      type: 'LICENSE_STATUS';
      states: string[];
      status?: 'ACTIVE' | 'UNRESTRICTED';
      allowProbation?: boolean;
    }
  | {
      type: 'PROCEDURE_VOLUME';
      procedureName: string;
      minProcedures: number;
      lookbackMonths: number;
    }
  | {
      type: 'DEA_REGISTRATION';
      schedules: string[];
    }
  | {
      type: 'SPECIALTY_MATCH';
      allowedSpecialties: string[];
    }
  | {
      type: 'CUSTOM';
      key: string;
      operator: CustomOperator;
      value: Primitive | Primitive[];
    }
  | {
      type: 'PRIVILEGE';
      privilegeCode: string;
      relationship?: PrivilegeDependencyRelation;
      description?: string;
    }
  | {
      type: 'CONFLICT' | 'PRIVILEGE_CONFLICT';
      privilegeCodes: string[];
      description?: string;
      severity?: PrivilegeConflictSeverity;
    };

export interface PrivilegeMatrixEntry {
  id: string;
  privilegeCode: string;
  name: string;
  specialty?: string | null;
  description?: string | null;
  prerequisites: PrivilegePrerequisite[];
  tags: string[];
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface PrivilegeNode {
  code: string;
  name: string;
  specialty?: string | null;
  description?: string | null;
  prerequisites: PrivilegePrerequisite[];
  tags: string[];
}

export interface PrivilegeGraph {
  rootCode: string;
  nodes: Map<string, PrivilegeNode>;
  downstream: Map<string, Set<string>>;
  upstream: Map<string, Set<string>>;
  conflicts: Map<string, Set<string>>;
  missingCodes: Set<string>;
}

export function normalizePrivilegeCode(code: string): string {
  return code
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

export function parsePrerequisites(raw: Prisma.JsonValue | null): PrivilegePrerequisite[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: PrivilegePrerequisite[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    const type = typeof candidate.type === 'string' ? candidate.type.toUpperCase() : undefined;
    if (!type) continue;

    switch (type) {
      case 'BOARD_CERT':
        parsed.push({
          type: 'BOARD_CERT',
          boards: toArray(candidate.boards as string[]).map((board) => board?.toString() ?? '').filter(Boolean),
          specialties: toArray(candidate.specialties as string[]).map((spec) => spec?.toString() ?? '').filter(Boolean),
          expirationBufferMonths:
            typeof candidate.expirationBufferMonths === 'number'
              ? candidate.expirationBufferMonths
              : undefined,
        });
        break;
      case 'LICENSE_STATUS':
        parsed.push({
          type: 'LICENSE_STATUS',
          states: toArray(candidate.states as string[]).map((state) => state?.toString().toUpperCase() ?? '').filter(Boolean),
          status:
            typeof candidate.status === 'string'
              ? (candidate.status.toUpperCase() as 'ACTIVE' | 'UNRESTRICTED')
              : undefined,
          allowProbation: Boolean(candidate.allowProbation),
        });
        break;
      case 'PROCEDURE_VOLUME':
        if (typeof candidate.procedureName === 'string' && typeof candidate.minProcedures === 'number' && typeof candidate.lookbackMonths === 'number') {
          parsed.push({
            type: 'PROCEDURE_VOLUME',
            procedureName: candidate.procedureName,
            minProcedures: candidate.minProcedures,
            lookbackMonths: candidate.lookbackMonths,
          });
        }
        break;
      case 'DEA_REGISTRATION':
        parsed.push({
          type: 'DEA_REGISTRATION',
          schedules: toArray(candidate.schedules as string[]).map((schedule) => schedule?.toString().toUpperCase() ?? '').filter(Boolean),
        });
        break;
      case 'SPECIALTY_MATCH':
        parsed.push({
          type: 'SPECIALTY_MATCH',
          allowedSpecialties: toArray(candidate.allowedSpecialties as string[])
            .map((spec) => spec?.toString() ?? '')
            .filter(Boolean),
        });
        break;
      case 'CUSTOM':
        if (typeof candidate.key === 'string' && typeof candidate.operator === 'string') {
          parsed.push({
            type: 'CUSTOM',
            key: candidate.key,
            operator: candidate.operator.toUpperCase() as CustomOperator,
            value: (candidate.value ?? null) as Primitive | Primitive[],
          });
        }
        break;
      case 'PRIVILEGE':
      case 'PRIVILEGE_DEPENDENCY':
        if (typeof candidate.privilegeCode === 'string') {
          parsed.push({
            type: 'PRIVILEGE',
            privilegeCode: candidate.privilegeCode,
            relationship:
              typeof candidate.relationship === 'string'
                ? (candidate.relationship.toUpperCase() as PrivilegeDependencyRelation)
                : 'REQUIRES',
            description: typeof candidate.description === 'string' ? candidate.description : undefined,
          });
        }
        break;
      case 'CONFLICT':
      case 'PRIVILEGE_CONFLICT':
      case 'MUTEX':
        parsed.push({
          type: 'CONFLICT',
          privilegeCodes: toArray(candidate.privilegeCodes as string[])
            .map((code) => code?.toString() ?? '')
            .filter(Boolean),
          description: typeof candidate.description === 'string' ? candidate.description : undefined,
          severity:
            typeof candidate.severity === 'string'
              ? (candidate.severity.toLowerCase() as PrivilegeConflictSeverity)
              : undefined,
        });
        break;
      default:
        // Unknown prerequisite type - ignore for graph building, but keep if it has privilegeCode
        if (typeof (candidate as any).privilegeCode === 'string') {
          parsed.push({
            type: 'PRIVILEGE',
            privilegeCode: (candidate as any).privilegeCode,
            relationship: 'REQUIRES',
          });
        }
    }
  }

  return parsed;
}

export function cloneMatrixEntry(record: PrivilegeMatrixEntry): PrivilegeNode {
  return {
    code: record.privilegeCode,
    name: record.name,
    specialty: record.specialty,
    description: record.description,
    prerequisites: record.prerequisites,
    tags: record.tags,
  };
}

