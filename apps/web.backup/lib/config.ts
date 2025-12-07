/**
 * Environment Configuration & Validation
 * Validates required environment variables at startup
 */

export interface AppConfig {
  apiBaseUrl: string;
  sentryDsn?: string;
  environment: 'development' | 'production' | 'test';
  pilotMode: boolean;
}

/**
 * Required environment variables for production
 */
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_API_BASE_URL',
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  NEXT_PUBLIC_SENTRY_DSN: undefined,
  NEXT_PUBLIC_PILOT_MODE: '0',
} as const;

/**
 * Validate environment configuration
 * @throws Error if required variables are missing
 */
export function validateConfig(): void {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\nPlease set these in your .env.local file or deployment environment.`;

    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMessage);
    } else {
      console.warn(`[Config Warning] ${errorMessage}`);
    }
  }
}

/**
 * Get validated application configuration
 */
export function getConfig(): AppConfig {
  validateConfig();

  return {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ||
                (typeof window !== 'undefined' ? window.location.origin : ''),
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: (process.env.NODE_ENV as AppConfig['environment']) || 'development',
    pilotMode: process.env.NEXT_PUBLIC_PILOT_MODE === '1',
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: string): boolean {
  const envVar = `NEXT_PUBLIC_FEATURE_${feature.toUpperCase()}`;
  return process.env[envVar] === '1' || process.env[envVar] === 'true';
}

// Validate config on module load (only in browser)
if (typeof window !== 'undefined') {
  try {
    validateConfig();
  } catch (error) {
    console.error('[Config] Validation failed:', error);
  }
}

