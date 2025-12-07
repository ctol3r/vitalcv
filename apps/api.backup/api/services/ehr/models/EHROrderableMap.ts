import { z } from 'zod';
import { normalizePrivilegeCode } from '../../privileging/models/PrivilegeMatrix';

export const EHR_SYSTEMS = ['EPIC', 'CERNER', 'MEDITECH'] as const;

export const EhrSystemSchema = z.enum(EHR_SYSTEMS);

export type EhrSystem = z.infer<typeof EhrSystemSchema>;

export const EHROrderableMapSchema = z.object({
  id: z.string().optional(),
  privilegeMatrixId: z.string().optional(),
  privilegeCode: z.string().min(1, 'Privilege code is required'),
  ehrSystem: EhrSystemSchema,
  ehrCode: z.string().min(1, 'EHR orderable code is required'),
  description: z.string().min(5).optional(),
  requiredRoles: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date().optional(),
  lastUpdatedAt: z.date().optional(),
});

export type EHROrderableMapEntry = z.infer<typeof EHROrderableMapSchema>;

export interface EHROrderableMapInput
  extends Omit<EHROrderableMapEntry, 'ehrSystem' | 'privilegeCode' | 'requiredRoles'> {
  ehrSystem: string;
  privilegeCode: string;
  requiredRoles?: string[];
}

export function normalizeEhrSystem(system: string): EhrSystem {
  const normalized = system?.trim().toUpperCase();
  if (!normalized || !EHR_SYSTEMS.includes(normalized as EhrSystem)) {
    throw new Error(`Unsupported EHR system: ${system}`);
  }
  return normalized as EhrSystem;
}

export function buildEHROrderableMapEntry(input: EHROrderableMapInput): EHROrderableMapEntry {
  const normalizedCode = normalizePrivilegeCode(input.privilegeCode);
  const normalizedSystem = normalizeEhrSystem(input.ehrSystem);
  const uniqueRoles = Array.from(new Set((input.requiredRoles ?? []).map((role) => role.trim()).filter(Boolean)));

  return EHROrderableMapSchema.parse({
    ...input,
    privilegeCode: normalizedCode,
    ehrSystem: normalizedSystem,
    requiredRoles: uniqueRoles,
    lastUpdatedAt: input.lastUpdatedAt ?? new Date(),
  });
}

export function isSupportedEhrSystem(system?: string | null): system is EhrSystem {
  if (!system) return false;
  try {
    normalizeEhrSystem(system);
    return true;
  } catch {
    return false;
  }
}
