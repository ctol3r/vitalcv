#!/usr/bin/env node
/**
 * Playbook chaos simulation — W2-PR114A.
 *
 * Synthesizes six C-PLAY-* failure modes against the validator and the
 * replayer, asserts each fails closed with the expected code, and emits a
 * verdict fingerprint used as `chaosFingerprint` in the next playbook
 * lineage manifest.
 *
 * Modes (deploy-playbook layer, complementary to C-DEPLOY-* / C-ROLL-* /
 * C-CERT-*):
 *   C-PLAY-1   tampered playbook content   → playbook-hash setHash differs
 *                                              between active and tampered copy
 *   C-PLAY-2   banned-string regression    → validator exits 1 PLAY-DRIFT-BANNED
 *   C-PLAY-3   STOP semantic removed       → validator exits 1 PLAY-DRIFT-SOFT-STOP
 *   C-PLAY-4   ambiguity branch erasure    → validator exits 1 PLAY-DRIFT-AMBIGUITY
 *   C-PLAY-5   recovery erasure            → validator exits 1 PLAY-DRIFT-RECOVERY
 *   C-PLAY-6   lineage manifest tamper     → replayer exits 1 PLAY-DRIFT-SET
 *
 * Exit codes:
 *   0 = all modes failed closed as required
 *   1 = a mode unexpectedly passed → fail-closed semantics broken
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync, statSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const TEMPLATES_DIR = resolve(ROOT, 'docs/deployment/playbooks/templates');
const HASH_SCRIPT = resolve(ROOT, 'scripts/deploy/playbooks/playbook-hash.mjs');
const VALIDATE_SCRIPT = resolve(ROOT, 'scripts/deploy/playbooks/playbook-validate.mjs');
const LINEAGE_SCRIPT = resolve(ROOT, 'scripts/deploy/playbooks/playbook-lineage.mjs');
const REPLAY_SCRIPT = resolve(ROOT, 'scripts/deploy/playbooks/playbook-replay.mjs');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function tmpRoot(label) {
  const dir = resolve(tmpdir(), `vitalcv-playbook-chaos-${label}-${randomBytes(6).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function copyTemplates(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(TEMPLATES_DIR)) {
    const src = resolve(TEMPLATES_DIR, entry);
    if (!statSync(src).isFile() || !entry.endsWith('.md')) continue;
    cpSync(src, resolve(targetDir, entry));
  }
}

function pickTemplate(dir, slug) {
  const path = resolve(dir, `${slug}.md`);
  if (!existsSync(path)) throw new Error(`tampered fixture target not found: ${path}`);
  return path;
}

function runValidator(templatesDir) {
  const result = spawnSync(
    process.execPath,
    [VALIDATE_SCRIPT, `--templates-dir=${templatesDir}`, '--json'],
    { encoding: 'utf-8' }
  );
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    /* leave null */
  }
  return { exitCode: result.status, parsed };
}

function runHasher(templatesDir) {
  const result = spawnSync(
    process.execPath,
    [HASH_SCRIPT, `--templates-dir=${templatesDir}`, '--bare'],
    { encoding: 'utf-8' }
  );
  return { exitCode: result.status, digest: result.stdout.trim() };
}

function runReplayer(manifestPath, templatesDir, lineageDir) {
  const result = spawnSync(
    process.execPath,
    [
      REPLAY_SCRIPT,
      `--path=${manifestPath}`,
      `--templates-dir=${templatesDir}`,
      `--lineage-dir=${lineageDir}`,
      '--json',
    ],
    { encoding: 'utf-8' }
  );
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    /* leave null */
  }
  return { exitCode: result.status, parsed };
}

function runLineageEmit(templatesDir, outputDir) {
  const result = spawnSync(
    process.execPath,
    [
      LINEAGE_SCRIPT,
      `--templates-dir=${templatesDir}`,
      `--output-dir=${outputDir}`,
      '--operator=chaos',
    ],
    { encoding: 'utf-8' }
  );
  return { exitCode: result.status, stdout: result.stdout };
}

const verdicts = [];

function record(mode, expectation, actual) {
  const passed = expectation(actual);
  verdicts.push({ mode, passed, actual });
  const tag = passed ? '✓' : '✗';
  process.stderr.write(
    `[playbook-chaos] ${tag} ${mode} ${passed ? 'failed-closed as required' : 'UNEXPECTED — fail-closed broken'}\n`
  );
  if (!passed) {
    process.stderr.write(`  actual: ${JSON.stringify(actual).slice(0, 240)}\n`);
  }
}

const cleanupDirs = [];
try {
  // ── C-PLAY-1 — tampered playbook content (digest differs) ──────────────
  {
    const dir = tmpRoot('c1');
    cleanupDirs.push(dir);
    copyTemplates(dir);
    const baseline = runHasher(dir);
    const target = pickTemplate(dir, 'pilot-institutional-rollout');
    const content = readFileSync(target, 'utf-8');
    writeFileSync(target, content + '\n<!-- chaos-tamper -->\n');
    const tampered = runHasher(dir);
    record(
      'C-PLAY-1',
      (a) => a.baseline.exitCode === 0 && a.tampered.exitCode === 0 && a.baseline.digest !== a.tampered.digest && /^[0-9a-f]{64}$/.test(a.tampered.digest),
      { baseline, tampered }
    );
  }

  // ── C-PLAY-2 — banned-string regression ────────────────────────────────
  {
    const dir = tmpRoot('c2');
    cleanupDirs.push(dir);
    copyTemplates(dir);
    const target = pickTemplate(dir, 'pilot-institutional-rollout');
    const content = readFileSync(target, 'utf-8');
    // Split-join so this source file isn't itself banned-string-positive.
    const phrase = ['HIPAA', 'compliant'].join(' ');
    writeFileSync(target, content + `\n\n<!-- ${phrase} -->\n`);
    const r = runValidator(dir);
    record(
      'C-PLAY-2',
      (a) => a.exitCode === 1 && a.parsed?.errors?.some((e) => e.code === 'PLAY-DRIFT-BANNED'),
      r
    );
  }

  // ── C-PLAY-3 — STOP semantic removed ───────────────────────────────────
  {
    const dir = tmpRoot('c3');
    cleanupDirs.push(dir);
    copyTemplates(dir);
    const target = pickTemplate(dir, 'pilot-institutional-rollout');
    const content = readFileSync(target, 'utf-8');
    // Replace the first 'on_missing: STOP' with 'on_missing: WARN'
    const mutated = content.replace('on_missing: STOP', 'on_missing: WARN');
    if (mutated === content) {
      record('C-PLAY-3', () => false, { reason: 'no on_missing: STOP found to mutate' });
    } else {
      writeFileSync(target, mutated);
      const r = runValidator(dir);
      record(
        'C-PLAY-3',
        (a) => a.exitCode === 1 && a.parsed?.errors?.some((e) => e.code === 'PLAY-DRIFT-SOFT-STOP'),
        r
      );
    }
  }

  // ── C-PLAY-4 — ambiguity branch erasure (if_unsure: continue) ──────────
  {
    const dir = tmpRoot('c4');
    cleanupDirs.push(dir);
    copyTemplates(dir);
    const target = pickTemplate(dir, 'pilot-institutional-rollout');
    const content = readFileSync(target, 'utf-8');
    const mutated = content.replace(/if_unsure:\s*escalate/, 'if_unsure: continue');
    if (mutated === content) {
      record('C-PLAY-4', () => false, { reason: 'no if_unsure: escalate found to mutate' });
    } else {
      writeFileSync(target, mutated);
      const r = runValidator(dir);
      record(
        'C-PLAY-4',
        (a) => a.exitCode === 1 && a.parsed?.errors?.some((e) => e.code === 'PLAY-DRIFT-AMBIGUITY'),
        r
      );
    }
  }

  // ── C-PLAY-5 — recovery erasure on a mutating step ─────────────────────
  {
    const dir = tmpRoot('c5');
    cleanupDirs.push(dir);
    copyTemplates(dir);
    const target = pickTemplate(dir, 'pilot-institutional-rollout');
    const content = readFileSync(target, 'utf-8');
    // Remove the recovery: line of step 1 (provision_tenant). Identify it by
    // its evidence_capture token to be precise.
    const lines = content.split('\n');
    const provIdx = lines.findIndex((l) => /step_id:\s*provision_tenant/.test(l));
    if (provIdx < 0) {
      record('C-PLAY-5', () => false, { reason: 'provision_tenant step not found' });
    } else {
      let recIdx = -1;
      for (let i = provIdx; i < lines.length; i++) {
        if (/^\s+recovery:/.test(lines[i])) { recIdx = i; break; }
        if (/^\d+\.\s+step_id:/.test(lines[i]) && i > provIdx) break;
      }
      if (recIdx < 0) {
        record('C-PLAY-5', () => false, { reason: 'provision_tenant recovery line not found' });
      } else {
        lines.splice(recIdx, 1);
        writeFileSync(target, lines.join('\n'));
        const r = runValidator(dir);
        record(
          'C-PLAY-5',
          (a) => a.exitCode === 1 && a.parsed?.errors?.some((e) => e.code === 'PLAY-DRIFT-RECOVERY'),
          r
        );
      }
    }
  }

  // ── C-PLAY-6 — lineage manifest tamper (forged setHash) ────────────────
  {
    const dir = tmpRoot('c6');
    cleanupDirs.push(dir);
    copyTemplates(dir);
    const lineageDir = resolve(dir, '.playbook-lineage');
    runLineageEmit(dir, lineageDir);
    const latestPath = resolve(lineageDir, 'latest.json');
    const manifest = JSON.parse(readFileSync(latestPath, 'utf-8'));
    // Forge the setHash and regenerate manifestId so the integrity check
    // passes — the lie is exclusively in playbookSetHash → must trip
    // PLAY-DRIFT-SET (or PLAY-DRIFT-MANIFEST if per-file diagnosis kicks in).
    manifest.playbookSetHash = 'forged-set-hash-' + 'c'.repeat(48);
    const { manifestId: _drop, ...rest } = manifest;
    const canonical = JSON.stringify(rest, Object.keys(rest).sort());
    manifest.manifestId = sha256(canonical);
    writeFileSync(latestPath, JSON.stringify(manifest, null, 2));
    const r = runReplayer(latestPath, dir, lineageDir);
    record(
      'C-PLAY-6',
      (a) => a.exitCode === 1 && (a.parsed?.code === 'PLAY-DRIFT-SET' || a.parsed?.code === 'PLAY-DRIFT-MANIFEST'),
      r
    );
  }
} finally {
  for (const d of cleanupDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
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
  process.stderr.write('\n[playbook-chaos] FAIL — at least one mode did not fail closed.\n');
  process.exit(1);
}

process.stderr.write(
  `\n[playbook-chaos] PASS — ${verdicts.length} modes, fingerprint=${fingerprint.slice(0, 12)}…\n`
);
process.exit(0);
