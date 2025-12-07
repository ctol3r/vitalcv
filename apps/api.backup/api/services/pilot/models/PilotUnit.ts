/**
 * S72-POST-3A-003: PilotUnit model
 *
 * Model for pilot units (Department/Clinic/service line) within a pilot organization.
 */

import { z } from 'zod';

export enum PilotUnitType {
  CLINIC = 'CLINIC',
  SERVICE_LINE = 'SERVICE_LINE',
  DEPT = 'DEPT',
}

export const PilotUnitSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Unit name is required'),
  type: z.nativeEnum(PilotUnitType),
  ehrCostCenterCode: z.string().optional(),
});

export type PilotUnitCreate = z.infer<typeof PilotUnitSchema>;

export function validatePilotUnit(data: unknown): PilotUnitCreate {
  return PilotUnitSchema.parse(data);
}

