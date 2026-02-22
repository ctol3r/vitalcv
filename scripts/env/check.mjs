#!/usr/bin/env node

/**
 * Validates that all required environment variables are present.
 * Mirrors the Zod schema in apps/api/backend/src/config/env.ts.
 *
 * Usage:
 *   node scripts/env/check.mjs                     # checks current env
 *   node scripts/env/check.mjs --mode=development  # relaxed checks
 *   node scripts/env/check.mjs --mode=production   # strict checks (default)
 *
 * Exit codes:
 *   0 = all required vars present
 *   1 = missing or invalid vars detected
 */

const REQUIRED_ALWAYS = [
  { name: 'DATABASE_URL', validate: (v) => v.length > 0 },
];

const REQUIRED_PRODUCTION = [
  { name: 'API_KEYS', validate: (v) => v.split(',').filter(Boolean).length > 0 },
  {
    name: 'CORS_ORIGIN',
    validate: (v) => {
      // In production, CORS_ORIGIN must be set and not "*"
      // Auto-resolution from RAILWAY_PUBLIC_DOMAIN is acceptable
      if (v === '*') return false;
      if (v.length > 0) return true;
      // Check if platform vars would auto-resolve
      return Boolean(
        process.env.RAILWAY_PUBLIC_DOMAIN ||
        process.env.RENDER_EXTERNAL_URL ||
        process.env.VERCEL_URL,
      );
    },
  },
];

const modeArg = process.argv.find((a) => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'production';

const checks = mode === 'production'
  ? [...REQUIRED_ALWAYS, ...REQUIRED_PRODUCTION]
  : REQUIRED_ALWAYS;

const missing = [];
const invalid = [];

for (const check of checks) {
  const value = (process.env[check.name] ?? '').trim();
  if (!value) {
    missing.push(check.name);
  } else if (!check.validate(value)) {
    invalid.push(check.name);
  }
}

const ok = missing.length === 0 && invalid.length === 0;

const report = {
  ok,
  mode,
  missing_keys: missing,
  invalid_keys: invalid,
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(report, null, 2));

if (!ok) {
  console.error(`\nEnvironment check FAILED (mode=${mode})`);
  if (missing.length) console.error(`  Missing: ${missing.join(', ')}`);
  if (invalid.length) console.error(`  Invalid: ${invalid.join(', ')}`);
  console.error('\nRun: node scripts/env/print-required.mjs --mode=' + mode);
  process.exit(1);
}

console.log(`\nEnvironment check PASSED (mode=${mode})`);
