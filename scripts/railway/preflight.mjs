#!/usr/bin/env node
/**
 * Railway deploy preflight checks — static assertions against source files.
 *
 * Validates that deploy-critical invariants hold before Railway ever builds.
 * No runtime dependencies, no imports from the app — reads files as text.
 *
 * Usage:  node scripts/railway/preflight.mjs
 * Exit:   0 = all pass, 1 = any fail
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const results = [];

function assert(name, condition, detail) {
  results.push({ name, ok: condition, detail: condition ? 'PASS' : detail });
}

function read(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

// ── server.ts assertions ──────────────────────────────────────
const serverSrc = read('apps/api/backend/src/server.ts');

assert(
  'PORT_BIND',
  /\.listen\(PORT,\s*HOST/.test(serverSrc),
  'server.ts must call .listen(PORT, HOST, ...) to bind on all interfaces',
);

assert(
  'BIND_HOST',
  serverSrc.includes("'0.0.0.0'"),
  "server.ts must bind to '0.0.0.0' (all interfaces)",
);

// ── app.ts assertions ─────────────────────────────────────────
const appSrc = read('apps/api/backend/src/app.ts');

assert(
  'HEALTH_ROUTE',
  appSrc.includes("'/health'"),
  "app.ts must register a '/health' route",
);

// Check that the /health handler block (next ~200 chars after route) is DB-free
const healthIdx = appSrc.indexOf("'/health'");
if (healthIdx !== -1) {
  const healthBlock = appSrc.substring(healthIdx, healthIdx + 300);
  assert(
    'HEALTH_DB_FREE',
    !healthBlock.includes('prisma'),
    '/health handler must not reference prisma (must be DB-independent)',
  );
} else {
  assert('HEALTH_DB_FREE', false, '/health route not found — cannot check DB independence');
}

assert(
  'READYZ_ROUTE',
  appSrc.includes("'/readyz'"),
  "app.ts must register a '/readyz' route for deep readiness checks",
);

// ── env.ts assertions ─────────────────────────────────────────
const envSrc = read('apps/api/backend/src/config/env.ts');

assert(
  'ENV_PROD_VARS',
  envSrc.includes('PRODUCTION_REQUIRED_VARS'),
  'env.ts must define PRODUCTION_REQUIRED_VARS',
);

assert(
  'ENV_ERROR_LOG',
  envSrc.includes('production_env_validation_failed'),
  'env.ts must log production_env_validation_failed event on error',
);

// ── railway.toml assertions ───────────────────────────────────
const toml = read('railway.toml');

assert(
  'TOML_HEALTHCHECK',
  toml.includes('healthcheckPath = "/health"'),
  'railway.toml healthcheckPath must be "/health"',
);

assert(
  'TOML_SKIP_MIGRATION',
  toml.includes('SKIP_STARTUP_MIGRATION=1'),
  'railway.toml startCommand must include SKIP_STARTUP_MIGRATION=1',
);

assert(
  'TOML_NO_INLINE_MIGRATE',
  !/startCommand.*prisma\s+migrate/.test(toml),
  'railway.toml startCommand must NOT run prisma migrate inline',
);

assert(
  'TOML_FROZEN_LOCKFILE',
  toml.includes('--frozen-lockfile'),
  'railway.toml installCommand must use --frozen-lockfile',
);

// ── Report ────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
const report = {
  passed: results.length - failed.length,
  failed: failed.length,
  total: results.length,
  assertions: results,
};

console.log(JSON.stringify(report, null, 2));

if (failed.length > 0) {
  console.error(`\n❌ ${failed.length} preflight check(s) failed`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${results.length} preflight checks passed`);
}
