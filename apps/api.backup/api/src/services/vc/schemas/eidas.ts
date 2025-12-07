import { z } from 'zod';

/**
 * eIDAS Compliant Credential Schema
 * Format: SD-JWT compliant
 */
export const EidasCredentialSchema = z.object({
  subjectId: z.string().describe('The subject identifier (e.g., DID)'),
  issuerId: z.string().describe('The issuer identifier (e.g., DID)'),
  credentialStatus: z.object({
    id: z.string().url(),
    type: z.string(),
  }).optional().describe('Status list reference for revocation'),

  // Selective Disclosure Fields
  claims: z.object({
    given_name: z.string().optional(),
    family_name: z.string().optional(),
    birth_date: z.string().optional(),
    nationality: z.string().optional(),
    resident_address: z.string().optional(),
    tax_id: z.string().optional(),
    trust_framework: z.string().optional().describe('The trust framework under which this credential was issued'),
    assurance_level: z.enum(['low', 'substantial', 'high']).optional().describe('eIDAS assurance level'),
  }).describe('Claims that can be selectively disclosed'),
});

export type EidasCredential = z.infer<typeof EidasCredentialSchema>;














