/**
 * S72-D1-C-001: PrivilegeSet Model
 *
 * Model representing a set of clinical privileges defined by an organization.
 * Privileges are procedure names/codes that clinicians can request.
 */

import { z } from 'zod';

/**
 * Procedure schema - represents a clinical procedure
 */
export const ProcedureSchema = z.object({
  code: z.string().min(1, 'Procedure code is required'),
  name: z.string().min(1, 'Procedure name is required'),
  category: z.string().optional(),
  description: z.string().optional(),
});

export type Procedure = z.infer<typeof ProcedureSchema>;

/**
 * Requirements schema for privilege set eligibility
 */
export const RequirementsSchema = z.object({
  minTrainingHours: z.number().int().nonnegative().optional(),
  boardCertRequired: z.boolean().default(false),
  licenseActive: z.boolean().default(true),
  npdbClean: z.boolean().default(true),
  minYearsExperience: z.number().nonnegative().optional(),
  specialtyMatch: z.array(z.string()).optional(), // Array of taxonomy codes
  additionalCriteria: z.record(z.any()).optional(), // Flexible additional requirements
});

export type Requirements = z.infer<typeof RequirementsSchema>;

/**
 * Schema for creating a new PrivilegeSet
 */
export const CreatePrivilegeSetSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Privilege set name is required').max(255),
  description: z.string().optional(),
  department: z.string().min(1, 'Department is required').max(100),
  procedures: z.array(ProcedureSchema).min(1, 'At least one procedure is required'),
  requirements: RequirementsSchema.optional(),
  isActive: z.boolean().default(true),
});

export type CreatePrivilegeSetInput = z.infer<typeof CreatePrivilegeSetSchema>;

/**
 * Schema for updating a PrivilegeSet
 */
export const UpdatePrivilegeSetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  department: z.string().min(1).max(100).optional(),
  procedures: z.array(ProcedureSchema).min(1).optional(),
  requirements: RequirementsSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePrivilegeSetInput = z.infer<typeof UpdatePrivilegeSetSchema>;

/**
 * Schema for querying PrivilegeSets
 */
export const QueryPrivilegeSetSchema = z.object({
  orgId: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type QueryPrivilegeSetInput = z.infer<typeof QueryPrivilegeSetSchema>;

/**
 * Convert Prisma PrivilegeSet to API response format
 */
export function serializePrivilegeSet(privilegeSet: any) {
  return {
    id: privilegeSet.id,
    orgId: privilegeSet.orgId,
    name: privilegeSet.name,
    description: privilegeSet.description,
    department: privilegeSet.department,
    procedures: privilegeSet.procedures as Procedure[],
    requirements: privilegeSet.requirements as Requirements,
    isActive: privilegeSet.isActive,
    createdAt: privilegeSet.createdAt.toISOString(),
    updatedAt: privilegeSet.updatedAt.toISOString(),
  };
}

/**
 * Validate privilege set procedures against known procedure codes
 * This is a placeholder - in production, validate against CPT/ICD-10-PCS codes
 */
export function validateProcedures(procedures: Procedure[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic validation
  const procedureCodes = new Set<string>();
  for (const proc of procedures) {
    // Check for duplicates
    if (procedureCodes.has(proc.code)) {
      errors.push(`Duplicate procedure code: ${proc.code}`);
    }
    procedureCodes.add(proc.code);

    // Validate code format (basic - expand as needed)
    if (proc.code.length < 2) {
      errors.push(`Invalid procedure code format: ${proc.code}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate simple procedure list for display (array of procedure names)
 * For backward compatibility with simpler use cases
 */
export function getSimpleProcedureList(procedures: Procedure[]): string[] {
  return procedures.map((p) => p.name);
}

