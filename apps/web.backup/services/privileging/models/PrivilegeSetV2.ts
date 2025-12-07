/**
 * B170A-PRIV-003: PrivilegeSet v2 model
 *
 * Privilege sets now reference canonical privilegeCodes from the PrivilegeMatrix.
 * This keeps procedure definitions in sync across organizations.
 */

import { z } from 'zod';
import { normalizePrivilegeCode, PrivilegeMatrixEntry } from './PrivilegeMatrix';

export const PrivilegeSetV2Schema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(3).max(255),
  specialty: z.string().min(3),
  description: z.string().optional(),
  privilegeCodes: z.array(z.string().min(4)).min(1, 'At least one privilege code is required'),
  isActive: z.boolean().default(true),
});

export type PrivilegeSetV2Input = z.infer<typeof PrivilegeSetV2Schema>;

export const CreatePrivilegeSetV2Schema = PrivilegeSetV2Schema.superRefine((value, ctx) => {
  const normalizedCodes = value.privilegeCodes.map((code) => normalizePrivilegeCode(code));
  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duplicate privilege codes are not allowed',
      path: ['privilegeCodes'],
    });
  }
});

export type CreatePrivilegeSetV2Input = z.infer<typeof CreatePrivilegeSetV2Schema>;

export const UpdatePrivilegeSetV2Schema = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  specialty: z.string().min(3).optional(),
  privilegeCodes: z.array(z.string().min(4)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePrivilegeSetV2Input = z.infer<typeof UpdatePrivilegeSetV2Schema>;

export interface PrivilegeSetV2Record {
  id: string;
  orgId: string;
  name: string;
  specialty: string;
  description?: string | null;
  privilegeCodes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  privileges?: PrivilegeMatrixEntry[];
}

export function normalizePrivilegeCodes(codes: string[]): string[] {
  return Array.from(new Set(codes.map(normalizePrivilegeCode)));
}

export function serializePrivilegeSetV2(
  privilegeSet: any,
  privilegeMatrix?: PrivilegeMatrixEntry[]
): PrivilegeSetV2Record {
  return {
    id: privilegeSet.id,
    orgId: privilegeSet.orgId,
    name: privilegeSet.name,
    specialty: privilegeSet.specialty,
    description: privilegeSet.description,
    privilegeCodes: privilegeSet.privileges
      ? privilegeSet.privileges.map((p: any) => p.privilegeCode)
      : privilegeSet.privilegeCodes || [],
    isActive: privilegeSet.isActive,
    createdAt: privilegeSet.createdAt instanceof Date ? privilegeSet.createdAt.toISOString() : privilegeSet.createdAt,
    updatedAt: privilegeSet.updatedAt instanceof Date ? privilegeSet.updatedAt.toISOString() : privilegeSet.updatedAt,
    privileges: privilegeMatrix,
  };
}

export function ensurePrivilegeCodesExist(
  requestedCodes: string[],
  availablePrivileges: PrivilegeMatrixEntry[]
) {
  const normalized = normalizePrivilegeCodes(requestedCodes);
  const missing = normalized.filter(
    (code) => !availablePrivileges.some((priv) => priv.privilegeCode === code)
  );

  if (missing.length > 0) {
    throw new Error(`Unknown privilege codes: ${missing.join(', ')}`);
  }

  return normalized;
}


