import { z } from 'zod';

export const PRIVILEGE_PROCEDURE_PROFILE_URL =
  'https://vitalcv.health/fhir/StructureDefinition/PrivilegeProcedure';
export const PRIVILEGE_CODE_SYSTEM = 'https://vitalcv.health/privileges';
export const PRIVILEGE_METADATA_EXTENSION_URL =
  'https://vitalcv.health/fhir/StructureDefinition/PrivilegeMetadata';

const PrivilegeCodingExtensionSchema = z.object({
  url: z.literal(PRIVILEGE_METADATA_EXTENSION_URL),
  valueString: z.string().optional(),
  valueCode: z.string().optional(),
  valueUri: z.string().url().optional(),
});

export const PrivilegeProcedureCodingSchema = z.object({
  system: z.literal(PRIVILEGE_CODE_SYSTEM),
  code: z.string().min(1),
  display: z.string().min(1),
  extension: z.array(PrivilegeCodingExtensionSchema).optional(),
});

const PerformerSchema = z.object({
  actor: z.object({
    reference: z.string().min(1),
    display: z.string().optional(),
  }),
  role: z
    .object({
      text: z.string().optional(),
    })
    .optional(),
});

const NoteSchema = z.object({
  text: z.string().min(1),
});

export const PrivilegeProcedureProfile = z.object({
  resourceType: z.literal('Procedure'),
  id: z.string().optional(),
  status: z.enum(['preparation', 'in-progress', 'completed']).default('completed'),
  code: z.object({
    coding: z.array(PrivilegeProcedureCodingSchema).min(1),
    text: z.string().optional(),
  }),
  subject: z.object({
    reference: z.string().min(1),
    display: z.string().optional(),
  }),
  performer: z.array(PerformerSchema).min(1),
  note: z.array(NoteSchema).optional(),
  meta: z
    .object({
      profile: z.array(z.literal(PRIVILEGE_PROCEDURE_PROFILE_URL)).default([
        PRIVILEGE_PROCEDURE_PROFILE_URL,
      ]),
    })
    .default({ profile: [PRIVILEGE_PROCEDURE_PROFILE_URL] }),
});

export type PrivilegeProcedureResource = z.infer<typeof PrivilegeProcedureProfile>;
