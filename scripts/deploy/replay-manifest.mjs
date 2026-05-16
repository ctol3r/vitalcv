#!/usr/bin/env node
/**
 * Environment replay — W2-PR50A.
 *
 * Given a manifest path or 'latest', recompute the config-hash from current
 * sources and report drift.
 *
 * Usage:
 *   node scripts/deploy/replay-manifest.mjs                  # latest
 *   node scripts/deploy/replay-manifest.mjs --path=<file>    # specific manifest
 *   node scripts/deploy/replay-manifest.mjs --json           # JSON only (no stderr summary)
 *
 * Drift codes (disjoint, named):
 *   DRIFT-CODE-CLEAN     same hash, lock, sha                                  (exit 0)
 *   DRIFT-CODE-CONFIG    same sha, different config hash                       (exit 1)
 *   DRIFT-CODE-LOCK      same sha, different lockfile sha                      (exit 1)
 *   DRIFT-CODE-SHA       different git sha (expected after deploy)             (exit 0)
 *   DRIFT-CODE-ORPHAN    manifest missing OR previousManifestId not present    (exit 1)
 *   DRIFT-CODE-TAMPER    manifestId != sha256(canonical body)                  (exit 1)
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

function readManifest() {
  const path = arg('path') || resolve(LINEAGE_DIR, 'latest.json');
  if (!existsSync(path)) {
    return { manifest: null, code: 'DRIFT-CODE-ORPHAN', reason: `manifest not found at ${path}` };
  }
  try {
    return { manifest: JSON.parse(readFileSync(path, 'utf-8')), code: null };
  } catch (err) {
    return { manifest: null, code: 'DRIFT-CODE-TAMPER', reason: `manifest parse failed: ${err.message}` };
  }
}

function recomputeConfigHash() {
  const lockfileSha = sha256(readFileSync(resolve(ROOT, 'pnpm-lock.yaml')));
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  const rootPackageIdentity = `${pkg.name ?? 'unnamed'}@${pkg.version ?? '0.0.0'}`;
  let gitSha = 'no-git';
  try {
    gitSha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    /* tolerated */
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
    requiredEnvNames, featureFlags, lockfileSha, rootPackageIdentity, gitSha,
  });
  return { digest: sha256(preimage), lockfileSha, gitSha };
}

function verifyManifestIntegrity(manifest) {
  const { manifestId, ...rest } = manifest;
  if (!manifestId) return { ok: false, reason: 'missing manifestId field' };
  const canonicalBody = JSON.stringify(rest, Object.keys(rest).sort());
  const recomputed = sha256(canonicalBody);
  if (recomputed !== manifestId) {
    return { ok: false, reason: `manifestId mismatch — expected ${recomputed}, got ${manifestId}` };
  }
  return { ok: true };
}

function checkLineageChain(manifest) {
  if (!manifest.previousManifestId) return { ok: true };
  if (!existsSync(LINEAGE_DIR)) {
    return { ok: false, reason: `previousManifestId set but lineage dir missing` };
  }
  const files = readdirSync(LINEAGE_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'latest.json'
  );
  for (const f of files) {
    try {
      const candidate = JSON.parse(readFileSync(resolve(LINEAGE_DIR, f), 'utf-8'));
      if (candidate.manifestId === manifest.previousManifestId) return { ok: true };
    } catch {
      /* skip unreadable */
    }
  }
  return {
    ok: false,
    reason: `previousManifestId ${manifest.previousManifestId} not found in ${LINEAGE_DIR}`,
  };
}

function classify(manifest, recomputed) {
  if (manifest.gitSha !== recomputed.gitSha) return 'DRIFT-CODE-SHA';
  if (manifest.lockfileSha !== recomputed.lockfileSha) return 'DRIFT-CODE-LOCK';
  if (manifest.configHash !== recomputed.digest) return 'DRIFT-CODE-CONFIG';
  return 'DRIFT-CODE-CLEAN';
}

const jsonOnly = process.argv.includes('--json');

const { manifest, code: readCode, reason: readReason } = readManifest();
if (!manifest) {
  process.stdout.write(JSON.stringify({ ok: false, code: readCode, reason: readReason }, null, 2) + '\n');
  process.exit(1);
}

const integrity = verifyManifestIntegrity(manifest);
if (!integrity.ok) {
  process.stdout.write(
    JSON.stringify({ ok: false, code: 'DRIFT-CODE-TAMPER', reason: integrity.reason }, null, 2) + '\n'
  );
  process.exit(1);
}

const chain = checkLineageChain(manifest);
if (!chain.ok) {
  process.stdout.write(
    JSON.stringify({ ok: false, code: 'DRIFT-CODE-ORPHAN', reason: chain.reason }, null, 2) + '\n'
  );
  process.exit(1);
}

const recomputed = recomputeConfigHash();
const code = classify(manifest, recomputed);
const ok = code === 'DRIFT-CODE-CLEAN' || code === 'DRIFT-CODE-SHA';

const report = {
  ok,
  code,
  manifestId: manifest.manifestId,
  manifestGitSha: manifest.gitSha,
  manifestConfigHash: manifest.configHash,
  manifestLockfileSha: manifest.lockfileSha,
  recomputedGitSha: recomputed.gitSha,
  recomputedConfigHash: recomputed.digest,
  recomputedLockfileSha: recomputed.lockfileSha,
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (!ok) {
  if (!jsonOnly) process.stderr.write(`\n[replay] DRIFT detected: ${code}\n`);
  process.exit(1);
}

if (!jsonOnly) process.stderr.write(`\n[replay] ${code} — manifest matches current source\n`);
process.exit(0);
