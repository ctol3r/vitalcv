#!/usr/bin/env node

/**
 * Prints the required environment variables for the VitalCV API backend.
 * Mirrors the Zod schema in apps/api/backend/src/config/env.ts.
 *
 * Usage: node scripts/env/print-required.mjs [--mode=production|development]
 */

const ENV_CONTRACT = [
  {
    name: 'NODE_ENV',
    required: 'always',
    default: 'development',
    hint: 'Set to "production" for deployed environments',
  },
  {
    name: 'PORT',
    required: 'always',
    default: '4000',
    hint: 'Railway sets this automatically',
  },
  {
    name: 'DATABASE_URL',
    required: 'always',
    default: null,
    hint: 'PostgreSQL connection string. Railway provides this via a linked Postgres service',
  },
  {
    name: 'API_KEYS',
    required: 'production',
    default: null,
    hint: 'Comma-separated API keys for client authentication',
  },
  {
    name: 'CORS_ORIGIN',
    required: 'production',
    default: 'Auto-resolved from RAILWAY_PUBLIC_DOMAIN; falls back to "*" (rejected in production)',
    hint: 'Allowed CORS origin. Must not be "*" in production',
  },
  {
    name: 'SKIP_STARTUP_MIGRATION',
    required: 'never',
    default: 'false',
    hint: 'Set to "1" when releaseCommand handles migrations (Railway default)',
  },
  {
    name: 'DEPLOY_MIGRATIONS_DONE',
    required: 'never',
    default: 'false',
    hint: 'Alternative to SKIP_STARTUP_MIGRATION',
  },
  {
    name: 'YC_DEMO_MODE',
    required: 'never',
    default: 'false',
    hint: 'Cannot be true in production unless SYSTEM_FROZEN is also true',
  },
  {
    name: 'SYSTEM_FROZEN',
    required: 'never',
    default: 'false',
    hint: 'Freezes all feature flags and blocks startup migrations',
  },
  {
    name: 'PILOT_MODE',
    required: 'never',
    default: 'false',
    hint: 'Enables pilot program features',
  },
  {
    name: 'ENTERPRISE_MODE',
    required: 'never',
    default: 'false',
    hint: 'Enables enterprise capabilities',
  },
  {
    name: 'LOW_FRICTION_MODE',
    required: 'never',
    default: 'false',
    hint: 'Reduces verification friction for onboarding',
  },
  {
    name: 'REAL_NURSYS_ENABLED',
    required: 'never',
    default: 'false',
    hint: 'Enables real Nursys PSV integration (vs mock)',
  },
  {
    name: 'MONITORING_SECRET',
    required: 'never',
    default: '""',
    hint: 'Secret for internal monitoring endpoints',
  },
  {
    name: 'INTERNAL_DASH_PASSWORD',
    required: 'never',
    default: '""',
    hint: 'Password for internal dashboard access',
  },
  {
    name: 'TRUST_STATE_RATE_LIMIT_PER_MINUTE',
    required: 'never',
    default: '60',
    hint: 'Rate limit for trust-state API endpoints',
  },
  {
    name: 'SENTRY_DSN',
    required: 'never',
    default: null,
    hint: 'Sentry DSN for error tracking. Omit to disable Sentry',
  },
];

const modeArg = process.argv.find((a) => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'production';

console.log(`\nVitalCV API — Environment Contract (mode: ${mode})\n`);
console.log('='.repeat(72));

for (const v of ENV_CONTRACT) {
  const isRequired =
    v.required === 'always' || (v.required === 'production' && mode === 'production');

  if (mode !== 'production' && v.required === 'production') continue;

  const tag = isRequired ? '[REQUIRED]' : '[optional]';
  const def = v.default ? `  default: ${v.default}` : '';
  console.log(`\n${tag} ${v.name}${def}`);
  console.log(`  ${v.hint}`);
}

console.log('\n' + '='.repeat(72));

const required = ENV_CONTRACT.filter(
  (v) => v.required === 'always' || (v.required === 'production' && mode === 'production'),
);

console.log(
  `\nMinimal .env for ${mode}:\n`,
);

for (const v of required) {
  const val = v.default && v.default !== 'null' ? v.default : '<SET_THIS>';
  console.log(`${v.name}=${val}`);
}

console.log('');
