/**
 * B133B-SBX-001: Partner Sandbox environment flag + config
 *
 * Sandbox mode configuration for partner integrations.
 * When enabled, uses separate DB/schema and never touches production data.
 */

export interface SandboxConfig {
  enabled: boolean;
  databaseUrl: string;
  schema: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  logging: {
    detailed: boolean;
    includePII: boolean;
  };
  baseUrl: string;
}

export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  sandbox: SandboxConfig;
  production: {
    databaseUrl: string;
    schema: string;
  };
}

/**
 * Determines if the current environment is running in sandbox mode
 * @returns {boolean} true if sandbox mode is enabled
 */
export function isSandboxMode(): boolean {
  return process.env.SANDBOX_MODE === 'true' || process.env.NODE_ENV === 'sandbox';
}

/**
 * Gets the appropriate database URL based on environment mode
 * @returns {string} Database URL for current mode
 */
export function getDatabaseUrl(): string {
  if (isSandboxMode()) {
    return process.env.SANDBOX_DATABASE_URL || process.env.DATABASE_URL || '';
  }
  return process.env.DATABASE_URL || '';
}

/**
 * Gets the database schema name based on environment mode
 * @returns {string} Schema name for current mode
 */
export function getDatabaseSchema(): string {
  if (isSandboxMode()) {
    return process.env.SANDBOX_DB_SCHEMA || 'sandbox';
  }
  return process.env.DATABASE_SCHEMA || 'public';
}

/**
 * Get comprehensive environment configuration
 * @returns {EnvironmentConfig} Complete environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const sandboxEnabled = isSandboxMode();

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4005', 10),

    sandbox: {
      enabled: sandboxEnabled,
      databaseUrl: process.env.SANDBOX_DATABASE_URL || process.env.DATABASE_URL || '',
      schema: process.env.SANDBOX_DB_SCHEMA || 'sandbox',
      rateLimit: {
        requestsPerMinute: parseInt(process.env.SANDBOX_RATE_LIMIT_PER_MINUTE || '10', 10),
        requestsPerHour: parseInt(process.env.SANDBOX_RATE_LIMIT_PER_HOUR || '100', 10),
      },
      logging: {
        detailed: process.env.SANDBOX_DETAILED_LOGGING === 'true',
        includePII: false, // Never log PII in sandbox
      },
      baseUrl: process.env.SANDBOX_BASE_URL || 'https://sandbox-api.vitalcv.com',
    },

    production: {
      databaseUrl: process.env.DATABASE_URL || '',
      schema: process.env.DATABASE_SCHEMA || 'public',
    },
  };
}

/**
 * Validates that sandbox configuration is complete
 * Throws error if required sandbox env vars are missing
 */
export function validateSandboxConfig(): void {
  if (!isSandboxMode()) {
    return;
  }

  const errors: string[] = [];

  if (!process.env.SANDBOX_DATABASE_URL && !process.env.DATABASE_URL) {
    errors.push('SANDBOX_DATABASE_URL or DATABASE_URL is required in sandbox mode');
  }

  if (!process.env.SANDBOX_BASE_URL) {
    errors.push('SANDBOX_BASE_URL is required in sandbox mode');
  }

  if (errors.length > 0) {
    throw new Error(
      `Sandbox configuration validation failed:\n${errors.join('\n')}`
    );
  }
}

/**
 * Ensures production data is never touched in sandbox mode
 * This is a safety check that should be called on startup
 */
export function ensureSandboxSafety(): void {
  if (!isSandboxMode()) {
    return;
  }

  const config = getEnvironmentConfig();

  // Verify sandbox is using different database
  if (config.sandbox.databaseUrl === config.production.databaseUrl &&
      config.sandbox.schema === config.production.schema) {
    throw new Error(
      'SAFETY CHECK FAILED: Sandbox mode is configured to use production database. ' +
      'Set SANDBOX_DATABASE_URL or SANDBOX_DB_SCHEMA to a separate sandbox instance.'
    );
  }

  console.log('✅ Sandbox safety check passed - using separate database/schema');
  console.log(`   Sandbox DB: ${config.sandbox.databaseUrl.substring(0, 30)}...`);
  console.log(`   Sandbox Schema: ${config.sandbox.schema}`);
}

/**
 * Get mode-specific environment variable
 * Automatically prefixes with SANDBOX_ in sandbox mode
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  if (isSandboxMode()) {
    const sandboxKey = `SANDBOX_${key}`;
    return process.env[sandboxKey] || process.env[key] || defaultValue || '';
  }
  return process.env[key] || defaultValue || '';
}

// Export singleton instance of config
export const envConfig = getEnvironmentConfig();

// Run safety check on module load if in sandbox mode
if (isSandboxMode()) {
  console.log('🏖️  SANDBOX MODE ACTIVE');
  validateSandboxConfig();
  ensureSandboxSafety();
}

