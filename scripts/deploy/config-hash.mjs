#!/usr/bin/env node
/**
 * Deterministic deployment config hash — W2-PR50A.
 *
 * Computes a content-addressed digest over the *names* (never values) of
 * required env vars + active feature flags, plus the lockfile SHA, root
 * package identity, and current git SHA. Re-running on the same source
 * MUST produce the identical digest; non-determinism is itself the failure.
 *
 * Usage:
 *   node scripts/deploy/config-hash.mjs                  # JSON to stdout
 *   node scripts/deploy/config-hash.mjs --bare           # digest only, no JSON
 *   node scripts/deploy/config-hash.mjs --features=A,B   # override active flag list
 *
 * Exit codes:
 *   0 = digest emitted
 *   1 = lockfile or package.json missing
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// Required env var NAMES — presence-only contributes to the hash. Values do not.
const REQUIRED_ENV_NAMES = [
  'API_KEYS',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'NODE_ENV',
];

// Optional env var NAMES whose presence (truthy value) flips the digest.
const FLAG_PREFIXES = ['FEATURE_', 'PILOT_', 'YC_DEMO_', 'SYSTEM_'];
const FLAG_SUFFIXES = ['_MODE', '_ENABLED'];

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function readLockfileSha() {
  const lockPath = resolve(ROOT, 'pnpm-lock.yaml');
  if (!existsSync(lockPath)) {
    console.error('FATAL: pnpm-lock.yaml not found at repo root');
    process.exit(1);
  }
  return sha256(readFileSync(lockPath));
}

function readRootPackageIdentity() {
  const pkgPath = resolve(ROOT, 'package.json');
  if (!existsSync(pkgPath)) {
    console.error('FATAL: root package.json not found');
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return `${pkg.name ?? 'unnamed'}@${pkg.version ?? '0.0.0'}`;
}

function readGitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'no-git';
  }
}

function activeFlagNames(env, override) {
  if (override !== undefined) {
    return override.split(',').map((s) => s.trim()).filter(Boolean).sort();
  }
  const truthy = new Set(['1', 'true', 'TRUE', 'yes', 'on']);
  return Object.keys(env)
    .filter((k) =>
      FLAG_PREFIXES.some((p) => k.startsWith(p)) ||
      FLAG_SUFFIXES.some((s) => k.endsWith(s))
    )
    .filter((k) => truthy.has((env[k] ?? '').trim()))
    .sort();
}

export function computeConfigHash({ env = process.env, featuresOverride } = {}) {
  const lockfileSha = readLockfileSha();
  const rootPackageIdentity = readRootPackageIdentity();
  const gitSha = readGitSha();
  const requiredEnvNames = [...REQUIRED_ENV_NAMES].sort();
  const featureFlags = activeFlagNames(env, featuresOverride);

  // Canonical pre-image: stable JSON over sorted inputs only.
  const preimage = JSON.stringify({
    schema: 'vitalcv.config-hash.v1',
    requiredEnvNames,
    featureFlags,
    lockfileSha,
    rootPackageIdentity,
    gitSha,
  });
  const digest = sha256(preimage);

  return {
    schema: 'vitalcv.config-hash.v1',
    digest,
    inputs: {
      requiredEnvNames,
      featureFlags,
      lockfileSha,
      rootPackageIdentity,
      gitSha,
    },
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const featuresArg = process.argv.find((a) => a.startsWith('--features='));
  const featuresOverride = featuresArg ? featuresArg.slice('--features='.length) : undefined;
  const bare = process.argv.includes('--bare');

  const result = computeConfigHash({ env: process.env, featuresOverride });

  if (bare) {
    process.stdout.write(result.digest + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}
