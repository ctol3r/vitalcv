/**
 * Pilot Signup Domain Model + Validation
 * B162B-PILOT-001
 */

import { PilotSignupStatus } from '@prisma/client';
import { z } from 'zod';

export const PilotSignupCreateSchema = z.object({
  orgName: z.string().trim().min(2, 'Organization name is required').max(120),
  contactName: z.string().trim().min(2, 'Contact name is required').max(120),
  email: z.string().trim().toLowerCase().email('Valid email required').max(320),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes limited to 2000 characters')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const PilotSignupStatusSchema = z.nativeEnum(PilotSignupStatus);

export const PilotSignupUpdateSchema = z.object({
  status: PilotSignupStatusSchema.optional(),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes limited to 2000 characters')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type PilotSignupCreateInput = z.infer<typeof PilotSignupCreateSchema>;
export type PilotSignupUpdateInput = z.infer<typeof PilotSignupUpdateSchema>;

export const TERMINAL_PILOT_SIGNUP_STATUSES = new Set<PilotSignupStatus>([
  PilotSignupStatus.APPROVED,
  PilotSignupStatus.REJECTED,
]);

export function normalizePilotSignupInput(
  input: PilotSignupCreateInput
): PilotSignupCreateInput {
  const result = PilotSignupCreateSchema.parse(input);
  return {
    ...result,
    orgName: collapseWhitespace(result.orgName),
    contactName: collapseWhitespace(result.contactName),
    email: result.email.trim().toLowerCase(),
    notes: result.notes ? sanitizeNotes(result.notes) : undefined,
  };
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizeNotes(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function isTerminalStatus(status: PilotSignupStatus): boolean {
  return TERMINAL_PILOT_SIGNUP_STATUSES.has(status);
}

