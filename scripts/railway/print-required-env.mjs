#!/usr/bin/env node
/**
 * Print required environment variables for Railway deployment.
 *
 * Reads PRODUCTION_REQUIRED_VARS from env.ts source so the list
 * stays in sync automatically — no manual duplication.
 *
 * Usage:  node scripts/railway/print-required-env.mjs [production|demo]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const mode = process.argv[2] ?? 'production';

// Parse PRODUCTION_REQUIRED_VARS from env.ts source
const envSrc = readFileSync(
  resolve(ROOT, 'apps/api/backend/src/config/env.ts'),
  'utf-8',
);
const match = envSrc.match(/PRODUCTION_REQUIRED_VARS\s*=\s*\[([\s\S]*?)\]/);
const codeVars = match
  ? [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : [];

console.log(`\n╔══════════════════════════════════════════════════╗`);
console.log(`║  Railway Environment Variables (${mode.padEnd(12)})     ║`);
console.log(`╚══════════════════════════════════════════════════╝\n`);

console.log(`── Must set manually ──────────────────────────────`);
for (const v of codeVars) {
  console.log(`  ${v}`);
}
console.log(`  NODE_ENV              (set to "production")`);

console.log(`\n── Auto-set by Railway ────────────────────────────`);
const autoVars = [
  ['PORT', 'Listening port (Railway assigns)'],
  ['RAILWAY_PUBLIC_DOMAIN', 'Public domain for the service'],
  ['RAILWAY_GIT_BRANCH', 'Branch being deployed'],
  ['RAILWAY_GIT_COMMIT_SHA', 'Commit SHA being deployed'],
];
for (const [name, desc] of autoVars) {
  console.log(`  ${name.padEnd(28)} ${desc}`);
}

if (mode === 'production') {
  console.log(`\n── Recommended for production ─────────────────────`);
  const recommended = [
    ['CORS_ORIGIN', 'Comma-separated allowed origins (auto-detects RAILWAY_PUBLIC_DOMAIN)'],
    ['SENTRY_DSN', 'Server-side error tracking'],
    ['MONITORING_SECRET', 'Secret for /api/internal/health endpoint'],
    ['INTERNAL_DASH_PASSWORD', 'Password for internal dashboard'],
  ];
  for (const [name, desc] of recommended) {
    console.log(`  ${name.padEnd(28)} ${desc}`);
  }
}

console.log('');
