/**
 * S72-POST-3A-001: PilotOrg metadata model
 *
 * Model for pilot organization metadata including sponsor information and EHR type.
 */

import { z } from 'zod';

export const PilotOrgSchema = z.object({
  pilotName: z.string().min(1, 'Pilot name is required'),
  sponsorName: z.string().min(1, 'Sponsor name is required'),
  sponsorEmail: z.string().email('Invalid sponsor email'),
  ehrType: z.string().optional(),
  notes: z.string().optional(),
});

export type PilotOrgCreate = z.infer<typeof PilotOrgSchema>;

export function validatePilotOrg(data: unknown): PilotOrgCreate {
  return PilotOrgSchema.parse(data);
}

