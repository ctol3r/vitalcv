/**
 * Environment Variable Validation with Zod
 *
 * Validates all required and optional environment variables at startup.
 * Ensures type safety and provides clear error messages for missing/invalid config.
 */

import { z } from 'zod';

/**
 * Zod schema for all environment variables
 */
const envSchema = z.object({
  // ============================================
  // Required Variables
  // ============================================

  /** Node environment */
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'sandbox'])
    .default('development'),

  /** Server port */
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535))
    .default('4000'),

  /** PostgreSQL connection string */
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a valid PostgreSQL connection string',
    }),

  /** JWT signing key - REQUIRED in production */
  SIGNING_KEY: z
    .string()
    .min(32, 'SIGNING_KEY must be at least 32 characters for security')
    .refine(
      (key) => {
        // Reject obvious development keys in production
        const devKeys = [
          'dev-signing-key',
          'change-in-production',
          'development',
          'secret',
          'your-secret',
        ];
        if (process.env.NODE_ENV === 'production') {
          return !devKeys.some((devKey) => key.toLowerCase().includes(devKey));
        }
        return true;
      },
      { message: 'SIGNING_KEY appears to be a development key. Use a secure key in production.' }
    ),

  // ============================================
  // Optional Variables with Defaults
  // ============================================

  /** Redis connection string */
  REDIS_URL: z.string().url().optional(),

  /** CORS origins (comma-separated) */
  CORS_ORIGIN: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .default('http://localhost:3000'),

  /** Log level */
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Log format */
  LOG_FORMAT: z.enum(['json', 'plain']).default('json'),

  /** Demo mode flag */
  DEMO_MODE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  /** Backend base URL */
  BACKEND_BASE_URL: z.string().url().default('http://localhost:4000'),

  /** Frontend base URL */
  FRONTEND_BASE_URL: z.string().url().default('http://localhost:3000'),

  // ============================================
  // External Service URLs
  // ============================================

  /** NPPES API base URL */
  NPPES_API_BASE: z.string().url().default('https://npiregistry.cms.hhs.gov'),

  /** NPPES proxy URL (optional) */
  NPPES_PROXY_URL: z.string().url().optional().or(z.literal('')),

  /** Public issuer URL */
  PUBLIC_ISSUER_URL: z.string().url().optional(),

  /** CSP report URI */
  CSP_REPORT_URI: z.string().default('/csp/report'),

  // ============================================
  // OpenAI Configuration (Optional)
  // ============================================

  /** OpenAI API key */
  OPENAI_API_KEY: z.string().optional().or(z.literal('')),

  /** Agent model */
  AGENT_MODEL: z.string().default('gpt-4o-mini'),

  /** Embedding model */
  EMBED_MODEL: z.string().default('text-embedding-3-small'),

  // ============================================
  // Vector Store Configuration
  // ============================================

  /** Vector backend type */
  MCP_VECTOR_BACKEND: z.enum(['memory', 'pgvector', 'qdrant']).default('memory'),

  /** PgVector dimensions */
  PGVECTOR_DIM: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('1536'),

  /** Qdrant URL */
  QDRANT_URL: z.string().url().optional(),

  /** Qdrant API key */
  QDRANT_API_KEY: z.string().optional().or(z.literal('')),

  // ============================================
  // Blockchain Configuration (Optional)
  // ============================================

  /** Substrate WebSocket endpoint */
  SUBSTRATE_WS: z.string().url().optional().or(z.literal('')),

  // ============================================
  // Sandbox Configuration
  // ============================================

  /** Sandbox mode flag */
  SANDBOX_MODE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  /** Sandbox database URL */
  SANDBOX_DATABASE_URL: z.string().url().optional(),

  /** Sandbox database schema */
  SANDBOX_DB_SCHEMA: z.string().default('sandbox'),

  /** Sandbox base URL */
  SANDBOX_BASE_URL: z.string().url().optional(),

  /** Sandbox rate limit per minute */
  SANDBOX_RATE_LIMIT_PER_MINUTE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10'),

  /** Sandbox rate limit per hour */
  SANDBOX_RATE_LIMIT_PER_HOUR: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('100'),

  // ============================================
  // Feature Flags
  // ============================================

  /** Enable SD-JWT support */
  ENABLE_SD_JWT: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  /** Enable BBS+ signatures */
  ENABLE_BBS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  /** Enable DIDComm v2 */
  ENABLE_DIDCOMM: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  /** Enable webhook HMAC verification */
  ENABLE_WEBHOOK_HMAC: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  /** Enable trust registry enforcement */
  ENABLE_TRUST_REGISTRY: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  /** Accept only EUDI wallets */
  ACCEPT_EUDI_WALLETS_ONLY: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // ============================================
  // Observability
  // ============================================

  /** Enable Prometheus metrics */
  ENABLE_METRICS: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  /** Metrics port */
  METRICS_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535))
    .default('9090'),

  /** Enable distributed tracing */
  ENABLE_TRACING: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

/**
 * Type for validated environment variables
 */
export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Validated environment singleton
 */
let validatedEnv: ValidatedEnv | null = null;

/**
 * Validation error class with detailed information
 */
export class EnvValidationError extends Error {
  constructor(
    public readonly errors: z.ZodError,
    public readonly missingVars: string[],
    public readonly invalidVars: Array<{ key: string; message: string }>
  ) {
    const missingMsg =
      missingVars.length > 0 ? `\nMissing required variables:\n  - ${missingVars.join('\n  - ')}` : '';

    const invalidMsg =
      invalidVars.length > 0
        ? `\nInvalid variables:\n${invalidVars.map((v) => `  - ${v.key}: ${v.message}`).join('\n')}`
        : '';

    super(`Environment validation failed:${missingMsg}${invalidMsg}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate environment variables and return typed config
 * Throws EnvValidationError if validation fails
 */
export function validateEnv(): ValidatedEnv {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missingVars: string[] = [];
    const invalidVars: Array<{ key: string; message: string }> = [];

    for (const error of result.error.errors) {
      const key = error.path.join('.');
      if (error.code === 'invalid_type' && error.received === 'undefined') {
        missingVars.push(key);
      } else {
        invalidVars.push({ key, message: error.message });
      }
    }

    throw new EnvValidationError(result.error, missingVars, invalidVars);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Get validated environment (throws if not validated)
 */
export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}

/**
 * Reset validated env (for testing)
 */
export function resetEnv(): void {
  validatedEnv = null;
}

/**
 * Print environment configuration (redacted for security)
 */
export function printEnvConfig(): void {
  const env = getEnv();

  console.log('\n=== Environment Configuration ===');
  console.log(`NODE_ENV: ${env.NODE_ENV}`);
  console.log(`PORT: ${env.PORT}`);
  console.log(`DATABASE_URL: ${env.DATABASE_URL.replace(/:[^@]+@/, ':****@')}`);
  console.log(`REDIS_URL: ${env.REDIS_URL ? env.REDIS_URL.replace(/:[^@]+@/, ':****@') : 'not configured'}`);
  console.log(`SIGNING_KEY: ${'*'.repeat(8)}...`);
  console.log(`DEMO_MODE: ${env.DEMO_MODE}`);
  console.log(`LOG_LEVEL: ${env.LOG_LEVEL}`);
  console.log(`SANDBOX_MODE: ${env.SANDBOX_MODE}`);

  console.log('\nFeature Flags:');
  console.log(`  ENABLE_SD_JWT: ${env.ENABLE_SD_JWT}`);
  console.log(`  ENABLE_BBS: ${env.ENABLE_BBS}`);
  console.log(`  ENABLE_DIDCOMM: ${env.ENABLE_DIDCOMM}`);
  console.log(`  ENABLE_TRUST_REGISTRY: ${env.ENABLE_TRUST_REGISTRY}`);

  console.log('\nObservability:');
  console.log(`  ENABLE_METRICS: ${env.ENABLE_METRICS}`);
  console.log(`  ENABLE_TRACING: ${env.ENABLE_TRACING}`);
  console.log('===================================\n');
}
