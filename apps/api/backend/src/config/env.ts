import { z } from 'zod';
import { log } from '../obs/logger';

type ApiKeyParseInput = string;

function normalizeCorsCandidate(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return trimmed;
    }
  }
  return `https://${trimmed}`;
}

function resolvePlatformCorsOrigin(): string {
  const candidates = [
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCorsCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export const PRODUCTION_REQUIRED_VARS = [
  'API_KEYS',
  'DATABASE_URL',
] as const;

export type ProductionEnvCheckReport = {
  ok: boolean;
  missing: string[];
};

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseApiKeys(raw: ApiKeyParseInput, isProduction: boolean): string[] {
  const values = raw
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  if (isProduction && values.length === 0) {
    throw new Error('API_KEYS must be defined in production');
  }

  return values;
}

function parseBooleanEnvVar(
  raw: unknown,
  fieldName: string,
  requiredInProduction: boolean,
): boolean {
  const normalized =
    raw === undefined || raw === null ? '' : String(raw).trim().toLowerCase();

  if (!normalized) {
    if (requiredInProduction && PRODUCTION) {
      throw new Error(`${fieldName} must be defined in production`);
    }
    return false;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  throw new Error(`${fieldName} must be 'true', 'false', '1', or '0'`);
}

const PRODUCTION = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  YC_DEMO_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'YC_DEMO_MODE', false);
  }, z.boolean()),
  CORS_ORIGIN: z.preprocess(
    (raw: unknown): string => {
      const rawValue = raw === undefined || raw === null ? '' : String(raw).trim();
      if (rawValue.length > 0) {
        return rawValue;
      }

      return resolvePlatformCorsOrigin() || '*';
    },
    z
      .string()
      .transform((value: string) => value.trim())
      .superRefine((value: string, ctx) => {
      if (process.env.NODE_ENV === 'production' && value === '*') {
        ctx.addIssue({
          code: 'custom',
          message: 'CORS_ORIGIN must not be "*" in production',
        });
      }
      }),
  ),
  API_KEYS: z.preprocess(
    (raw) => {
      if (raw === undefined) {
        return '';
      }
      return String(raw);
    },
    z
      .string()
      .transform((raw) => parseApiKeys(raw, PRODUCTION)),
  ),
  TRUST_STATE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  MONITORING_SECRET: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string(),
  ),
  INTERNAL_DASH_PASSWORD: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string(),
  ),
  PILOT_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'PILOT_MODE', false);
  }, z.boolean()),
  ENTERPRISE_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'ENTERPRISE_MODE', false);
  }, z.boolean()),
  LOW_FRICTION_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'LOW_FRICTION_MODE', false);
  }, z.boolean()),
  SYSTEM_FROZEN: z.preprocess((raw) => parseBooleanEnvVar(raw, 'SYSTEM_FROZEN', false), z.boolean()),
  REAL_NURSYS_ENABLED: z.preprocess((raw) => parseBooleanEnvVar(raw, 'REAL_NURSYS_ENABLED', false), z.boolean()),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function resolveValue(raw: unknown): string {
  return String(raw ?? '').trim();
}

export function getProductionEnvCheck(): ProductionEnvCheckReport {
  const missing = PRODUCTION_REQUIRED_VARS.filter((name) => !resolveValue(process.env[name]).length);

  return {
    ok: missing.length === 0,
    missing,
  };
}

/**
 * Parse and validate environment variables.
 * Throws on missing required vars so the process fails fast before serving traffic.
 */
export function loadEnv(): Env {
  const productionMode =
    process.env.NODE_ENV === 'production' ||
    String(process.env.NODE_ENV).trim().toLowerCase() === 'production';
  if (productionMode) {
    const missing = getProductionEnvCheck();
    if (!missing.ok) {
      const formatted = missing.missing.map((name) => `${name}: required in production`).join('\n');
      log('error', `environment validation failed: ${formatted}`, {
        event: 'production_env_validation_failed',
        missing: missing.missing,
        details: formatted,
        node_env: process.env.NODE_ENV ?? 'development',
        railway_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
        railway_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      });
      throw new Error(`Environment validation failed:\n${formatted}`);
    }
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    const missingKeys = result.error.issues
      .filter((i) => i.code === 'too_small' || i.message.toLowerCase().includes('required'))
      .map((i) => i.path.join('.'));
    const invalidKeys = result.error.issues
      .filter((i) => i.code !== 'too_small' && !i.message.toLowerCase().includes('required'))
      .map((i) => i.path.join('.'));
    log('error', `environment validation failed: ${formatted}`, {
      event: 'env_validation_failed',
      missing_keys: missingKeys,
      invalid_keys: invalidKeys,
      fields: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
      railway_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
      railway_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    });
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  // Wave 34: Fail fast if production runs with demo mode enabled.
  // YC_DEMO_MODE=true in production is a safety violation unless SYSTEM_FROZEN overrides it.
  if (
    productionMode &&
    result.data.YC_DEMO_MODE &&
    !result.data.SYSTEM_FROZEN
  ) {
    throw new Error(
      'YC_DEMO_MODE cannot be enabled in production. Set YC_DEMO_MODE=false or enable SYSTEM_FROZEN.',
    );
  }

  const frozen = result.data.SYSTEM_FROZEN;
  if (frozen) {
    const blockedFlags = {
      YC_DEMO_MODE: result.data.YC_DEMO_MODE,
      ENTERPRISE_MODE: result.data.ENTERPRISE_MODE,
      REAL_NURSYS_ENABLED: result.data.REAL_NURSYS_ENABLED,
      LOW_FRICTION_MODE: result.data.LOW_FRICTION_MODE,
    } as const;

    for (const [name, value] of Object.entries(blockedFlags) as Array<
      [keyof typeof blockedFlags, boolean]
    >) {
      if (!value) {
        continue;
      }

      log('warn', 'feature flag blocked by SYSTEM_FROZEN', {
        event: 'feature_lock_blocked',
        feature: name,
      });
      process.env[name] = 'false';
    }

    result.data = {
      ...result.data,
      YC_DEMO_MODE: false,
      ENTERPRISE_MODE: false,
      REAL_NURSYS_ENABLED: false,
      LOW_FRICTION_MODE: false,
    };
  }

  _env = result.data;
  return _env;
}

/**
 * Access validated env after loadEnv() has been called.
 * Throws if called before loadEnv().
 */
export function env(): Env {
  if (!_env) {
    throw new Error('env() called before loadEnv(). Call loadEnv() during server startup.');
  }
  return _env;
}
