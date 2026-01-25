/**
 * STUB: Runtime configuration loader (fail-fast).
 * TODO: Wire to shared infrastructure config source.
 */

export type RuntimeEnvironment = 'production' | 'staging' | 'development';

export interface RuntimeConfig {
  environment: RuntimeEnvironment;
  backendUrl: string;
}

const REQUIRED_KEYS = ['VITALCV_ENV', 'NEXT_PUBLIC_BACKEND_URL'] as const;

function isRuntimeEnvironment(value: string): value is RuntimeEnvironment {
  return value === 'production' || value === 'staging' || value === 'development';
}

/**
 * STUB: Validate required environment variables and return typed config.
 */
export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const missing = REQUIRED_KEYS.filter((key) => !String(env[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const environment = String(env.VITALCV_ENV).trim();
  if (!isRuntimeEnvironment(environment)) {
    throw new Error(`Invalid VITALCV_ENV value: ${environment}`);
  }

  return {
    environment,
    backendUrl: String(env.NEXT_PUBLIC_BACKEND_URL).trim(),
  };
}
