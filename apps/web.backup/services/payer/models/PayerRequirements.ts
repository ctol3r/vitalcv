/**
 * B169C-PAYER-003: Payer requirement templates
 *
 * Requirements are stored as JSON blobs in the `PayerRequirement.requirements` column.
 * This file provides a typed schema + parser so the requirements engine can work with
 * strongly-typed definitions.
 */

import { z } from 'zod';

export const RequirementSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const RequirementTypeSchema = z.enum([
  'STATE_LICENSE',
  'DEA_REGISTRATION',
  'BOARD_CERTIFICATION',
  'PECOS_ENROLLMENT',
  'MALPRACTICE',
]);

export const RequirementDefinitionSchema = z.object({
  id: z.string().min(1),
  type: RequirementTypeSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  severity: RequirementSeveritySchema.default('medium'),
  optional: z.boolean().default(false),
  nextAction: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type RequirementDefinition = z.infer<typeof RequirementDefinitionSchema>;

const RequirementDefinitionsSchema = z
  .array(RequirementDefinitionSchema)
  .or(RequirementDefinitionSchema);

export function parseRequirementDefinitions(payload: unknown): RequirementDefinition[] {
  const parsed = RequirementDefinitionsSchema.parse(payload ?? []);
  return Array.isArray(parsed) ? parsed : [parsed];
}

/**
 * B169C-PAYER-003: Payer requirement templates
 *
 * Stores structured requirement definitions (license, DEA, PECOS, etc.)
 * that the requirements engine evaluates per payer + specialty.
 */

import { z } from 'zod';

export const REQUIREMENT_TYPES = [
  'STATE_LICENSE',
  'DEA_REGISTRATION',
  'BOARD_CERTIFICATION',
  'PECOS_ENROLLMENT',
  'MALPRACTICE',
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type RequirementSeverity = (typeof REQUIREMENT_SEVERITIES)[number];

export const RequirementDefinitionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(REQUIREMENT_TYPES),
  label: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(REQUIREMENT_SEVERITIES).default('medium'),
  optional: z.boolean().default(false),
  nextAction: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type RequirementDefinition = z.infer<typeof RequirementDefinitionSchema>;

const RequirementDefinitionArraySchema = z.array(RequirementDefinitionSchema).min(1);

/**
 * Parses the JSON stored in `PayerRequirement.requirements`.
 */
export function parseRequirementDefinitions(payload: unknown): RequirementDefinition[] {
  if (Array.isArray(payload)) {
    return RequirementDefinitionArraySchema.parse(payload);
  }

  // Support legacy single-object payloads by normalizing to an array
  return RequirementDefinitionArraySchema.parse([payload]);
}
/**
 * B169C-PAYER-003: PayerRequirements model
 *
 * Stores requirement templates (per payer + specialty) used by the
 * requirements engine to determine met/unmet statuses.
 */

import { z } from 'zod';

export const RequirementTypeSchema = z.enum([
  'STATE_LICENSE',
  'DEA_REGISTRATION',
  'BOARD_CERTIFICATION',
  'PECOS_ENROLLMENT',
  'MALPRACTICE',
]);

export type RequirementType = z.infer<typeof RequirementTypeSchema>;

export const RequirementDefinitionSchema = z.object({
  id: z.string().min(1),
  type: RequirementTypeSchema,
  label: z.string(),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  optional: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
  nextAction: z.string().optional(),
});

export type RequirementDefinition = z.infer<typeof RequirementDefinitionSchema>;

export const PayerRequirementsSchema = z.object({
  payerId: z.string(),
  specialty: z.string().default('ALL'),
  requirements: z.array(RequirementDefinitionSchema).min(1),
  metadata: z.record(z.any()).optional(),
});

export type PayerRequirementsConfig = z.infer<typeof PayerRequirementsSchema>;

export function parsePayerRequirements(data: unknown): PayerRequirementsConfig {
  return PayerRequirementsSchema.parse(data);
}

export function parseRequirementDefinitions(data: unknown): RequirementDefinition[] {
  return z.array(RequirementDefinitionSchema).parse(data);
}

