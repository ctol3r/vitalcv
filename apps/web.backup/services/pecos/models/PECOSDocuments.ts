/**
 * B169A-PECOS-002: PECOSDocument model definition
 *
 * Captures structured data parsed from CMS 855 enrollment packets.
 */

import { z } from 'zod';

export enum PecosDocumentType {
  CMS855I = 'CMS855I',
  CMS855R = 'CMS855R',
  CMS855B = 'CMS855B',
}

const dateLike = z.union([z.date(), z.string()]).nullable().optional();

const BasePecosDocumentSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
  documentType: z.nativeEnum(PecosDocumentType),
  submittedAt: dateLike,
  parsedFields: z.record(z.any()).optional(),
  storageUrl: z.string().url().optional(),
});

export const CreatePecosDocumentSchema = BasePecosDocumentSchema.extend({
  id: z.string().optional(),
});

export const UpdatePecosDocumentSchema = BasePecosDocumentSchema.partial().extend({
  id: z.string().cuid('Valid document id is required when updating'),
});

export type PecosDocumentInput = z.infer<typeof CreatePecosDocumentSchema>;
export type UpdatePecosDocumentInput = z.infer<typeof UpdatePecosDocumentSchema>;

export function parsePecosDocument(data: unknown): PecosDocumentInput {
  return CreatePecosDocumentSchema.parse(data);
}

export function parsePecosDocumentUpdate(data: unknown): UpdatePecosDocumentInput {
  return UpdatePecosDocumentSchema.parse(data);
}

