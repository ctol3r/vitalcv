/**
 * B136A-EHR-001: EHR Integration Configuration Model
 *
 * Supports Epic, Cerner, and Generic FHIR R6 servers.
 * Stores authentication configuration (OAuth2 client credentials, JWT, or Basic auth).
 */

import { z } from 'zod';

export type EhrType = 'epic' | 'cerner' | 'generic';
export type EhrAuthType = 'client_credentials' | 'jwt' | 'basic';

/**
 * EHR Configuration Zod Schema for validation
 */
export const EhrConfigSchema = z.object({
  id: z.string().optional(),
  orgId: z.string().min(1, 'Organization ID is required'),
  ehrType: z.enum(['epic', 'cerner', 'generic']),
  fhirBaseUrl: z.string().url('Must be a valid FHIR base URL'),
  authType: z.enum(['client_credentials', 'jwt', 'basic']),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  jwtKey: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

/**
 * EHR Configuration TypeScript type
 */
export type EhrConfig = z.infer<typeof EhrConfigSchema>;

/**
 * Create EHR Configuration input (excludes generated fields)
 */
export const CreateEhrConfigSchema = EhrConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateEhrConfigInput = z.infer<typeof CreateEhrConfigSchema>;

/**
 * Update EHR Configuration input (all fields optional except orgId)
 */
export const UpdateEhrConfigSchema = EhrConfigSchema.partial().required({ orgId: true });

export type UpdateEhrConfigInput = z.infer<typeof UpdateEhrConfigSchema>;

/**
 * Validation helper: Ensure required auth fields are present based on authType
 */
export function validateEhrAuthConfig(config: CreateEhrConfigInput | UpdateEhrConfigInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.authType === 'client_credentials') {
    if (!config.clientId) errors.push('clientId is required for client_credentials auth');
    if (!config.clientSecret) errors.push('clientSecret is required for client_credentials auth');
  } else if (config.authType === 'jwt') {
    if (!config.jwtKey) errors.push('jwtKey is required for JWT auth');
  } else if (config.authType === 'basic') {
    if (!config.clientId) errors.push('clientId (username) is required for basic auth');
    if (!config.clientSecret) errors.push('clientSecret (password) is required for basic auth');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * EHR-specific defaults for Epic and Cerner
 */
export const EHR_DEFAULTS: Record<EhrType, { tokenEndpoint?: string; scope?: string }> = {
  epic: {
    tokenEndpoint: '/oauth2/token',
    scope: 'system/Practitioner.read system/PractitionerRole.read',
  },
  cerner: {
    tokenEndpoint: '/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
    scope: 'system/Practitioner.read system/PractitionerRole.read',
  },
  generic: {
    // No defaults for generic FHIR servers
  },
};

