#!/usr/bin/env node
/**
 * Deployment lineage manifest emitter — W2-PR50A.
 *
 * Captures a content-addressed manifest of *what is being deployed* and writes
 * it to .deployment-lineage/<sha>-<isoTs>.json plus a latest.json pointer.
 * Manifests are immutable: re-emitting on the same source produces the same
 * body shape (modulo timestamp / operator) and a different file path.
 *
 * Usage:
 *   node scripts/deploy/lineage.mjs                              # forward deploy
 *   node scripts/deploy/lineage.mjs --rollback-of=<manifestId>   # rollback
 *   node scripts/deploy/lineage.mjs --env=staging                # named env
 *   node scripts/deploy/lineage.mjs --platform=vercel            # platform
 *   node scripts/deploy/lineage.mjs --operator=ci@github         # override operator
 *   node scripts/deploy/lineage.mjs --chaos-fingerprint=<sha>    # chaos verdict digest
 *   node scripts/deploy/lineage.mjs --dry-run                    # emit JSON to stdout, no write
 *
 * Exit codes:
 *   0 = manifest written (or printed in dry-run)
 *   1 = config-hash failed or write failed
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const LINEAGE_DIR = resolve(ROOT, '.deployment-lineage');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function arg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(`--${name}=`.length) : fallback;
}

function readLatestPointer() {
  const p = resolve(LINEAGE_DIR, 'latest.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir() {
  if (!existsSync(LINEAGE_DIR)) {
    mkdirSync(LINEAGE_DIR, { recursive: true });
  }
}

function nodeVersion() {
  return process.version.replace(/^v/, '');
}

function pnpmVersion() {
  try {
    return execSync('pnpm --version', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function operatorIdentity() {
  return (
    arg('operator') ||
    process.env.GITHUB_ACTOR ||
    process.env.USER ||
    'unknown'
  );
}

function platformIdentity() {
  return (
    arg('platform') ||
    (process.env.VERCEL ? 'vercel' :
      process.env.RAILWAY_ENVIRONMENT ? 'railway' :
      process.env.GITHUB_ACTIONS ? 'github-actions' :
      'local')
  );
}

function envName() {
  return arg('env') || process.env.DEPLOY_ENV || process.env.NODE_ENV || 'local';
}

function inlineConfigHash() {
  const lockPath = resolve(ROOT, 'pnpm-lock.yaml');
  const pkgPath = resolve(ROOT, 'package.json');
  if (!existsSync(lockPath) || !existsSync(pkgPath)) {
    console.error('FATAL: lockfile or package.json missing');
    process.exit(1);
  }
  const lockfileSha = sha256(readFileSync(lockPath));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const rootPackageIdentity = `${pkg.name ?? 'unnamed'}@${pkg.version ?? '0.0.0'}`;
  let gitSha = 'no-git';
  try {
    gitSha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    /* tolerated — no-git is a valid value */
  }
  const requiredEnvNames = ['API_KEYS', 'CORS_ORIGIN', 'DATABASE_URL', 'NODE_ENV'];
  const truthy = new Set(['1', 'true', 'TRUE', 'yes', 'on']);
  const featureFlags = Object.keys(process.env)
    .filter((k) =>
      ['FEATURE_', 'PILOT_', 'YC_DEMO_', 'SYSTEM_'].some((p) => k.startsWith(p)) ||
      ['_MODE', '_ENABLED'].some((s) => k.endsWith(s))
    )
    .filter((k) => truthy.has((process.env[k] ?? '').trim()))
    .sort();

  const preimage = JSON.stringify({
    schema: 'vitalcv.config-hash.v1',
    requiredEnvNames,
    featureFlags,
    lockfileSha,
    rootPackageIdentity,
    gitSha,
  });
  return {
    digest: sha256(preimage),
    inputs: { requiredEnvNames, featureFlags, lockfileSha, rootPackageIdentity, gitSha },
  };
}

function buildManifest() {
  const { digest: configHash, inputs } = inlineConfigHash();
  const buildTimestampUtc = arg('timestamp') || new Date().toISOString();
  const previous = readLatestPointer();
  const previousManifestId = previous?.manifestId ?? null;
  const rollbackOf = arg('rollback-of') || null;
  const chaosFingerprint = arg('chaos-fingerprint') || 'CHAOS_NOT_RUN';

  const body = {
    schema: 'vitalcv.deployment-lineage.v1',
    gitSha: inputs.gitSha,
    configHash,
    lockfileSha: inputs.lockfileSha,
    rootPackageIdentity: inputs.rootPackageIdentity,
    envName: envName(),
    platform: platformIdentity(),
    operator: operatorIdentity(),
    buildTimestampUtc,
    nodeVersion: nodeVersion(),
    pnpmVersion: pnpmVersion(),
    featureFlags: inputs.featureFlags,
    previousManifestId,
    rollbackOf,
    chaosFingerprint,
  };
  // manifestId = sha256 over canonical body (sorted top-level keys).
  const canonicalBody = JSON.stringify(body, Object.keys(body).sort());
  const manifestId = sha256(canonicalBody);
  return { manifestId, ...body };
}

const manifest = buildManifest();
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  process.exit(0);
}

ensureDir();

const safeTs = manifest.buildTimestampUtc.replace(/[:.]/g, '-');
const fileName = `${manifest.gitSha.slice(0, 12)}-${safeTs}.json`;
const filePath = resolve(LINEAGE_DIR, fileName);
const latestPath = resolve(LINEAGE_DIR, 'latest.json');

writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(latestPath, JSON.stringify(manifest, null, 2) + '\n');

process.stderr.write(
  `[lineage] wrote ${fileName} (manifestId=${manifest.manifestId.slice(0, 12)}…, configHash=${manifest.configHash.slice(0, 12)}…)\n`
);
process.stdout.write(
  JSON.stringify({ ok: true, manifestId: manifest.manifestId, path: fileName }, null, 2) + '\n'
);
