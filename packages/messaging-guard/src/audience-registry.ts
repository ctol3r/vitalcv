/**
 * B98B-SEC-001: Audience Claims Registry
 *
 * Centralized registry of valid audience claims per environment.
 * Audience claims enforce environment isolation and prevent cross-environment message routing.
 *
 * Format: {environment}.vitalcv.com or vitalcv.com (production only)
 */

export type Environment = 'development' | 'staging' | 'production';

export interface AudienceClaim {
  /** Audience claim value */
  value: string;
  /** Environment this audience is valid for */
  environment: Environment;
  /** Human-readable description */
  description: string;
  /** Whether this is the primary audience for the environment */
  primary?: boolean;
}

/**
 * Official audience claims registry
 */
export const AUDIENCE_REGISTRY: AudienceClaim[] = [
  {
    value: 'dev.vitalcv.com',
    environment: 'development',
    description: 'Development environment audience',
    primary: true,
  },
  {
    value: 'staging.vitalcv.com',
    environment: 'staging',
    description: 'Staging environment audience',
    primary: true,
  },
  {
    value: 'vitalcv.com',
    environment: 'production',
    description: 'Production environment audience',
    primary: true,
  },
  // Allow alternative formats for backward compatibility
  {
    value: 'development.vitalcv.com',
    environment: 'development',
    description: 'Alternative development audience format',
    primary: false,
  },
];

/**
 * Get primary audience for an environment
 */
export function getPrimaryAudience(environment: Environment | string): string {
  const normalizedEnv = normalizeEnvironment(environment);
  const primary = AUDIENCE_REGISTRY.find(
    claim => claim.environment === normalizedEnv && claim.primary === true
  );
  return primary?.value || getDefaultAudience(normalizedEnv);
}

/**
 * Get all valid audiences for an environment
 */
export function getAudiencesForEnvironment(environment: Environment | string): string[] {
  const normalizedEnv = normalizeEnvironment(environment);
  return AUDIENCE_REGISTRY
    .filter(claim => claim.environment === normalizedEnv)
    .map(claim => claim.value);
}

/**
 * Check if an audience claim is valid for an environment
 */
export function isValidAudienceForEnvironment(
  audience: string | string[],
  environment: Environment | string
): boolean {
  const normalizedEnv = normalizeEnvironment(environment);
  const validAudiences = getAudiencesForEnvironment(normalizedEnv);
  const audiences = Array.isArray(audience) ? audience : [audience];

  return audiences.some(aud => validAudiences.includes(aud));
}

/**
 * Normalize environment string to Environment type
 */
export function normalizeEnvironment(env: string): Environment {
  const lower = env.toLowerCase();
  if (lower === 'dev' || lower === 'development') return 'development';
  if (lower === 'staging' || lower === 'stage') return 'staging';
  if (lower === 'prod' || lower === 'production') return 'production';
  return 'development'; // Default to development for unknown
}

/**
 * Get default audience for an environment (fallback)
 */
function getDefaultAudience(environment: Environment): string {
  const defaults: Record<Environment, string> = {
    development: 'dev.vitalcv.com',
    staging: 'staging.vitalcv.com',
    production: 'vitalcv.com',
  };
  return defaults[environment];
}

/**
 * Validate audience claim format
 */
export function isValidAudienceFormat(audience: string): boolean {
  // Allow domain format: {env}.vitalcv.com or vitalcv.com
  const domainPattern = /^([a-z0-9-]+\.)?vitalcv\.com$/;
  return domainPattern.test(audience);
}

