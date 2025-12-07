import { z } from 'zod';

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
    .regex(/[A-Z0-9\-]+/, 'Privilege code must be uppercase alphanumeric with dashes'),
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
      return `Board certification (${prerequisite.boards.join(', ')}) in ${
        prerequisite.specialties.join(', ') || 'aligned specialty'
      } ${
        prerequisite.expirationBufferMonths
          ? `valid for at least ${prerequisite.expirationBufferMonths} more months`
          : ''
      }`.trim();
    case 'LICENSE_STATUS':
      return `Active, unrestricted license${
        prerequisite.states.length ? ` in ${prerequisite.states.join(', ')}` : ''
      }${prerequisite.allowProbation ? ' (probation acceptable)' : ''}`;
    case 'PROCEDURE_VOLUME':
      return `At least ${prerequisite.minProcedures} ${prerequisite.procedureName} cases within ${
        prerequisite.lookbackMonths
      } months${prerequisite.includesAssists ? ' (assists count)' : ''}`;
    case 'DEA_REGISTRATION':
      return `DEA registration covering schedules: ${prerequisite.schedules.join(', ')}`;
    case 'SPECIALTY_MATCH':
      return `Clinician specialty must match: ${prerequisite.allowedSpecialties.join(', ')}`;
    case 'CUSTOM':
      return `Custom requirement ${prerequisite.key} ${prerequisite.operator} ${Array.isArray(prerequisite.value)
        ? prerequisite.value.join(', ')
        : prerequisite.value}`;
    default:
      return 'Clinical prerequisite';
  }
}
