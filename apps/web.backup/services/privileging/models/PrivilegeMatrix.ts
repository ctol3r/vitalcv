import { z } from 'zod';

export const PrivilegeCodeRegex = /[A-Z0-9\-]+/;

export const PrivilegePrerequisiteSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BOARD_CERT'),
    boards: z.array(z.string().min(1, 'Board name is required')).min(1),
    specialties: z.array(z.string().min(1)).default([]),
    expirationBufferMonths: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal('LICENSE_STATUS'),
    states: z.array(z.string().min(1)).default([]),
    status: z.enum(['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'PROBATION']).default('ACTIVE'),
    allowProbation: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('PROCEDURE_VOLUME'),
    procedureName: z.string().min(3),
    minProcedures: z.number().int().positive(),
    lookbackMonths: z.number().int().positive(),
    includesAssists: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('DEA_REGISTRATION'),
    schedules: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('SPECIALTY_MATCH'),
    allowedSpecialties: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('CUSTOM'),
    key: z.string().min(1),
    operator: z.enum(['EQUALS', 'GTE', 'LTE', 'IN']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
  }),
]);

export type PrivilegePrerequisite = z.infer<typeof PrivilegePrerequisiteSchema>;

export const PrivilegeMatrixEntrySchema = z.object({
  id: z.string().optional(),
  specialty: z.string().min(1, 'Specialty is required'),
  privilegeCode: z
    .string()
    .min(1, 'Privilege code is required')
    .regex(PrivilegeCodeRegex, 'Privilege code must be uppercase alphanumeric with dashes'),
  name: z.string().min(1, 'Privilege name is required'),
  description: z.string().min(10, 'Privilege description should provide clinical context'),
  prerequisites: z.array(PrivilegePrerequisiteSchema).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
});

export type PrivilegeMatrixEntry = z.infer<typeof PrivilegeMatrixEntrySchema>;

export interface PrivilegeMatrixEntryInput
  extends Omit<PrivilegeMatrixEntry, 'privilegeCode' | 'prerequisites' | 'tags' | 'isActive'> {
  privilegeCode: string;
  prerequisites?: PrivilegePrerequisite[];
  tags?: string[];
  isActive?: boolean;
}

export interface PrivilegeMatrixFilter {
  specialty?: string;
  search?: string;
  tags?: string[];
  includeInactive?: boolean;
}

export function normalizePrivilegeCode(code: string): string {
  return code
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

export function buildPrivilegeMatrixEntry(input: PrivilegeMatrixEntryInput): PrivilegeMatrixEntry {
  const normalizedCode = normalizePrivilegeCode(input.privilegeCode);
  return PrivilegeMatrixEntrySchema.parse({
    ...input,
    privilegeCode: normalizedCode,
    prerequisites: input.prerequisites ?? [],
    tags: input.tags ?? [],
    isActive: input.isActive ?? true,
  });
}

export function filterPrivilegeMatrixEntries(
  entries: PrivilegeMatrixEntry[],
  filter?: PrivilegeMatrixFilter
): PrivilegeMatrixEntry[] {
  if (!filter) return entries;

  const specialty = filter.specialty?.toLowerCase();
  const search = filter.search?.toLowerCase();
  const tags = filter.tags?.map((tag) => tag.toLowerCase());

  return entries.filter((entry) => {
    if (!filter.includeInactive && !entry.isActive) {
      return false;
    }

    if (specialty && entry.specialty.toLowerCase() !== specialty) {
      return false;
    }

    if (tags && tags.length > 0) {
      const entryTags = (entry.tags ?? []).map((tag) => tag.toLowerCase());
      const matches = tags.every((tag) => entryTags.includes(tag));
      if (!matches) return false;
    }

    if (search) {
      const haystack = `${entry.privilegeCode} ${entry.name} ${entry.description ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

export function describePrerequisite(prerequisite: PrivilegePrerequisite): string {
  switch (prerequisite.type) {
    case 'BOARD_CERT':
      return `Board certification (${prerequisite.boards.join(', ')}) in ${prerequisite.specialties.join(', ') || 'aligned specialty'} ${
        prerequisite.expirationBufferMonths
          ? `valid for at least ${prerequisite.expirationBufferMonths} more months`
          : ''
      }`.trim();
    case 'LICENSE_STATUS':
      return `Active, unrestricted license${prerequisite.states.length ? ` in ${prerequisite.states.join(', ')}` : ''}${
        prerequisite.allowProbation ? ' (probation acceptable)' : ''
      }`;
    case 'PROCEDURE_VOLUME':
      return `At least ${prerequisite.minProcedures} ${prerequisite.procedureName} cases within ${prerequisite.lookbackMonths} months${
        prerequisite.includesAssists ? ' (assists count)' : ''
      }`;
    case 'DEA_REGISTRATION':
      return `DEA registration covering schedules: ${prerequisite.schedules.join(', ')}`;
    case 'SPECIALTY_MATCH':
      return `Clinician specialty must match: ${prerequisite.allowedSpecialties.join(', ')}`;
    case 'CUSTOM':
      return `Custom requirement ${prerequisite.key} ${prerequisite.operator} ${Array.isArray(prerequisite.value) ? prerequisite.value.join(', ') : prerequisite.value}`;
    default:
      return 'Clinical prerequisite';
  }
}
/**
 * B170A-PRIV-001: PrivilegeMatrix model
 *
 * Stores canonical privilege definitions by specialty with structured prerequisites.
 * Each privilege is keyed by a deterministic privilegeCode (e.g., CARD-CATH-ADULT).
 */

import { z } from 'zod';

/**
 * Supported prerequisite categories. The enum intentionally mirrors the
 * compliance checks performed during privilege request validation.
 */
export const PrivilegePrerequisiteType = z.enum([
  'BOARD_CERT',
  'LICENSE_STATUS',
  'PROCEDURE_VOLUME',
  'DEA_REGISTRATION',
  'SPECIALTY_MATCH',
  'CUSTOM',
]);

const BoardCertificationPrerequisiteSchema = z.object({
  type: z.literal('BOARD_CERT'),
  boards: z.array(z.string().min(2)).nonempty('At least one board must be specified'),
  specialties: z.array(z.string().min(3)).default([]),
  expirationBufferMonths: z.number().int().min(0).max(24).default(0),
  description: z.string().optional(),
});

const LicenseStatusPrerequisiteSchema = z.object({
  type: z.literal('LICENSE_STATUS'),
  states: z.array(z.string().regex(/^[A-Z]{2}$/)).default([]),
  status: z.enum(['ACTIVE', 'UNRESTRICTED']),
  allowProbation: z.boolean().default(false),
  description: z.string().optional(),
});

const ProcedureVolumePrerequisiteSchema = z.object({
  type: z.literal('PROCEDURE_VOLUME'),
  procedureName: z.string().min(3),
  minProcedures: z.number().int().positive(),
  lookbackMonths: z.number().int().positive().max(60).default(24),
  includeAssistCases: z.boolean().default(true),
  description: z.string().optional(),
});

const DeaRegistrationPrerequisiteSchema = z.object({
  type: z.literal('DEA_REGISTRATION'),
  schedules: z.array(z.string().regex(/^[IIIVX]+$/i)).min(1),
  description: z.string().optional(),
});

const SpecialtyMatchPrerequisiteSchema = z.object({
  type: z.literal('SPECIALTY_MATCH'),
  allowedSpecialties: z.array(z.string().min(3)).nonempty(),
  allowSubspecialtyPrefixMatch: z.boolean().default(true),
  description: z.string().optional(),
});

const CustomPrerequisiteSchema = z.object({
  type: z.literal('CUSTOM'),
  key: z.string().min(1),
  operator: z.enum(['EQUALS', 'GTE', 'LTE', 'IN']).default('EQUALS'),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
  description: z.string().optional(),
});

export const PrivilegePrerequisiteSchema = z.discriminatedUnion('type', [
  BoardCertificationPrerequisiteSchema,
  LicenseStatusPrerequisiteSchema,
  ProcedureVolumePrerequisiteSchema,
  DeaRegistrationPrerequisiteSchema,
  SpecialtyMatchPrerequisiteSchema,
  CustomPrerequisiteSchema,
]);

/**
 * Canonical privilege definition schema.
 */
export const PrivilegeMatrixEntrySchema = z.object({
  specialty: z.string().trim().min(3, 'Specialty/taxonomy is required'),
  privilegeCode: z
    .string()
    .min(4)
    .regex(/^[A-Z0-9-]+$/, 'Privilege code must be uppercase with hyphens'),
  name: z.string().min(5, 'Privilege name is required'),
  description: z.string().min(10, 'Privilege description is required'),
  prerequisites: z.array(PrivilegePrerequisiteSchema).default([]),
  tags: z.array(z.string()).default([]),
  references: z
    .array(
      z.object({
        label: z.string().min(2),
        url: z.string().url(),
      })
    )
    .default([]),
  version: z.string().regex(/^v\d+$/, 'Version must look like v1').default('v1'),
  isActive: z.boolean().default(true),
});

export type PrivilegeMatrixEntry = z.infer<typeof PrivilegeMatrixEntrySchema>;
export type PrivilegePrerequisite = z.infer<typeof PrivilegePrerequisiteSchema>;

/**
 * Normalize privilege codes to the canonical "CARD-CATH-ADULT" form.
 */
export function normalizePrivilegeCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Helper to coerce raw input into a validated matrix entry.
 */
export function buildPrivilegeMatrixEntry(input: z.input<typeof PrivilegeMatrixEntrySchema>) {
  return PrivilegeMatrixEntrySchema.parse({
    ...input,
    privilegeCode: normalizePrivilegeCode(input.privilegeCode),
    specialty: input.specialty.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
  });
}

/**
 * Filter privilege matrix entries by specialty or fuzzy text search.
 */
export function filterPrivilegeMatrixEntries(
  entries: PrivilegeMatrixEntry[],
  filters: { specialty?: string; search?: string }
) {
  const { specialty, search } = filters;
  const normalizedSearch = search?.trim().toLowerCase();

  return entries.filter((entry) => {
    if (specialty && entry.specialty.toLowerCase() !== specialty.toLowerCase()) {
      return false;
    }

    if (normalizedSearch) {
      const haystack = `${entry.privilegeCode} ${entry.name} ${entry.description}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    return entry.isActive;
  });
}

/**
 * Group privilege definitions by specialty for quick lookup.
 */
export function groupPrivilegesBySpecialty(entries: PrivilegeMatrixEntry[]) {
  return entries.reduce<Record<string, PrivilegeMatrixEntry[]>>((acc, entry) => {
    const key = entry.specialty;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(entry);
    return acc;
  }, {});
}

/**
 * Format prerequisites for UI/voice-over rendering.
 */
export function describePrerequisite(prereq: PrivilegePrerequisite): string {
  switch (prereq.type) {
    case 'BOARD_CERT':
      return `Board certification: ${prereq.boards.join(', ')}${prereq.specialties.length ? ` (${prereq.specialties.join(', ')})` : ''}`;
    case 'LICENSE_STATUS':
      return `License status: ${prereq.status}${prereq.states.length ? ` in ${prereq.states.join(', ')}` : ''}`;
    case 'PROCEDURE_VOLUME':
      return `Procedure volume: ≥${prereq.minProcedures} ${prereq.procedureName} cases in the last ${prereq.lookbackMonths} months`;
    case 'DEA_REGISTRATION':
      return `DEA registration covering schedules ${prereq.schedules.join(', ')}`;
    case 'SPECIALTY_MATCH':
      return `Specialty match: ${prereq.allowedSpecialties.join(', ')}`;
    case 'CUSTOM':
      return `Custom requirement: ${prereq.key} ${prereq.operator} ${Array.isArray(prereq.value) ? prereq.value.join(', ') : prereq.value}`;
    default:
      return 'Additional prerequisite';
  }
}


