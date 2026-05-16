#!/usr/bin/env node
/**
 * Deployment chaos simulation — W2-PR50A.
 *
 * Synthesizes deploy-layer failure modes against scripts/deploy/replay-manifest.mjs
 * and asserts each mode fails closed. Emits a chaos verdict digest used as
 * `chaosFingerprint` in the next lineage manifest.
 *
 * Modes (deploy-layer, complementary to scale-gate's app-layer):
 *   C-DEPLOY-1   missing manifest path                 → replay exits 1, code DRIFT-CODE-ORPHAN
 *   C-DEPLOY-2   tampered manifest body                → replay exits 1, code DRIFT-CODE-TAMPER
 *   C-DEPLOY-3   forged config hash on same SHA        → replay exits 1, code DRIFT-CODE-CONFIG
 *   C-DEPLOY-4   truncated lineage chain               → replay exits 1, code DRIFT-CODE-ORPHAN
 *   C-DEPLOY-5   lineage emitter must always include   → lineage --dry-run output contains
 *                rollbackOf field (null or string)       'rollbackOf' key
 *
 * Exit codes:
 *   0 = all modes failed closed as required
 *   1 = a mode unexpectedly passed → fail-closed semantics broken
 */
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const REPLAY_SCRIPT = resolve(ROOT, 'scripts/deploy/replay-manifest.mjs');
const LINEAGE_SCRIPT = resolve(ROOT, 'scripts/deploy/lineage.mjs');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function tmpRoot() {
  const dir = resolve(tmpdir(), `vitalcv-deploy-chaos-${randomBytes(6).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function craftManifest(overrides = {}) {
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
  const featureFlags = [];
  const preimage = JSON.stringify({
    schema: 'vitalcv.config-hash.v1',
    requiredEnvNames, featureFlags, lockfileSha, rootPackageIdentity, gitSha,
  });
  const configHash = sha256(preimage);
  const body = {
    schema: 'vitalcv.deployment-lineage.v1',
    gitSha,
    configHash,
    lockfileSha,
    rootPackageIdentity,
    envName: 'chaos',
    platform: 'chaos',
    operator: 'chaos',
    buildTimestampUtc: '2026-01-01T00:00:00.000Z',
    nodeVersion: '20.0.0',
    pnpmVersion: '10.0.0',
    featureFlags,
    previousManifestId: null,
    rollbackOf: null,
    chaosFingerprint: 'CHAOS_NOT_RUN',
    ...overrides,
  };
  const canonicalBody = JSON.stringify(body, Object.keys(body).sort());
  const manifestId = sha256(canonicalBody);
  return { manifestId, ...body };
}

function regenerateManifestId(manifest) {
  const { manifestId: _drop, ...body } = manifest;
  const canonicalBody = JSON.stringify(body, Object.keys(body).sort());
  manifest.manifestId = sha256(canonicalBody);
  return manifest;
}

function runReplay(manifestPath) {
  const result = spawnSync(
    process.execPath,
    [REPLAY_SCRIPT, `--path=${manifestPath}`, '--json'],
    { encoding: 'utf-8' }
  );
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    /* parsed remains null */
  }
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr, parsed };
}

function runLineageDryRun() {
  const result = spawnSync(
    process.execPath,
    [LINEAGE_SCRIPT, '--dry-run'],
    { encoding: 'utf-8' }
  );
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    /* parsed remains null */
  }
  return { exitCode: result.status, parsed };
}

const verdicts = [];

function record(mode, expectation, actual) {
  const passed = expectation(actual);
  verdicts.push({ mode, passed, actual });
  const tag = passed ? '✓' : '✗';
  process.stderr.write(
    `[chaos] ${tag} ${mode} ${passed ? 'failed-closed as required' : 'UNEXPECTED — fail-closed broken'}\n`
  );
  if (!passed) {
    process.stderr.write(`         actual: ${JSON.stringify(actual)}\n`);
  }
}

const dir = tmpRoot();
try {
  // C-DEPLOY-1 — missing manifest path
  {
    const missing = resolve(dir, 'definitely-not-there.json');
    const r = runReplay(missing);
    record(
      'C-DEPLOY-1',
      (a) => a.exitCode === 1 && a.parsed?.code === 'DRIFT-CODE-ORPHAN',
      r
    );
  }

  // C-DEPLOY-2 — tampered manifest body (manifestId no longer matches body)
  {
    const m = craftManifest();
    m.envName = 'tampered-after-write'; // mutate without regenerating manifestId
    const p = resolve(dir, 'tampered.json');
    writeFileSync(p, JSON.stringify(m, null, 2));
    const r = runReplay(p);
    record(
      'C-DEPLOY-2',
      (a) => a.exitCode === 1 && a.parsed?.code === 'DRIFT-CODE-TAMPER',
      r
    );
  }

  // C-DEPLOY-3 — forged config hash on same SHA (manifestId regenerated to
  // pass the integrity check; the lie is in configHash → must trip CONFIG drift)
  {
    const forged = craftManifest({
      configHash: 'forged-config-hash-' + 'a'.repeat(46),
    });
    regenerateManifestId(forged);
    const p = resolve(dir, 'forged-config.json');
    writeFileSync(p, JSON.stringify(forged, null, 2));
    const r = runReplay(p);
    record(
      'C-DEPLOY-3',
      (a) => a.exitCode === 1 && a.parsed?.code === 'DRIFT-CODE-CONFIG',
      r
    );
  }

  // C-DEPLOY-4 — truncated lineage chain (previousManifestId points to absent file)
  {
    const orphan = craftManifest({
      previousManifestId: 'orphan-ref-' + 'b'.repeat(53),
    });
    regenerateManifestId(orphan);
    const p = resolve(dir, 'orphan-prev.json');
    writeFileSync(p, JSON.stringify(orphan, null, 2));
    const r = runReplay(p);
    record(
      'C-DEPLOY-4',
      (a) => a.exitCode === 1 && a.parsed?.code === 'DRIFT-CODE-ORPHAN',
      r
    );
  }

  // C-DEPLOY-5 — lineage emitter must always include rollbackOf field
  {
    const r = runLineageDryRun();
    record(
      'C-DEPLOY-5',
      (a) => a.exitCode === 0 && a.parsed && 'rollbackOf' in a.parsed,
      r
    );
  }
} finally {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

const allPassed = verdicts.every((v) => v.passed);
const fingerprint = sha256(
  JSON.stringify(verdicts.map((v) => ({ mode: v.mode, passed: v.passed })))
);

process.stdout.write(
  JSON.stringify(
    {
      ok: allPassed,
      modes: verdicts.length,
      passed: verdicts.filter((v) => v.passed).length,
      fingerprint,
      verdicts: verdicts.map((v) => ({ mode: v.mode, passed: v.passed })),
    },
    null,
    2
  ) + '\n'
);

if (!allPassed) {
  process.stderr.write('\n[chaos] FAIL — at least one mode did not fail closed.\n');
  process.exit(1);
}

process.stderr.write(
  `\n[chaos] PASS — ${verdicts.length} modes, fingerprint=${fingerprint.slice(0, 12)}…\n`
);
process.exit(0);
