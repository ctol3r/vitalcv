import { z } from 'zod';

type ApiKeyParseInput = string;

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

const PRODUCTION = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  YC_DEMO_MODE: z.preprocess((raw) => {
    if (raw === undefined) {
      return false;
    }

    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
    }

    return raw;
  }, z.boolean()),
  CORS_ORIGIN: z
    .string()
    .default('*')
    .transform((value) => value.trim())
    .superRefine((value, ctx) => {
      if (process.env.NODE_ENV === 'production' && value === '*') {
        ctx.addIssue({
          code: 'custom',
          message: 'CORS_ORIGIN must not be "*" in production',
        });
      }
    }),
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
  SAM_API_KEY: z.string().optional(),
  MONITORING_SECRET: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string().superRefine((value, ctx) => {
      if (PRODUCTION && value.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'MONITORING_SECRET is required in production',
        });
      }
    }),
  ),
  INTERNAL_DASH_PASSWORD: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string().superRefine((value, ctx) => {
      if (PRODUCTION && value.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'INTERNAL_DASH_PASSWORD is required in production',
        });
      }
    }),
  ),
  PILOT_MODE: z.preprocess((raw) => {
    if (raw === undefined) return false;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
    }
    return raw;
  }, z.boolean()),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Parse and validate environment variables.
 * Throws on missing required vars so the process fails fast before serving traffic.
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
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
