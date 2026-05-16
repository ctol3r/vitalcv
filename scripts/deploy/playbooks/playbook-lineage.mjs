#!/usr/bin/env node
/**
 * Playbook lineage manifest emitter — W2-PR114A.
 *
 * Emits a vitalcv.playbook-lineage.v1 manifest into .playbook-lineage/
 * capturing the current playbook-set digest, the per-playbook hash list, a
 * cross-link to the deployment lineage manifest (optional), and named
 * onboarding metrics (when supplied).
 *
 * Usage:
 *   node scripts/deploy/playbooks/playbook-lineage.mjs
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --link-deploy
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --operator=ci@github
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --chaos-fingerprint=<sha>
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --time-to-first-credential=<sec>
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --reviewer-handoff-count=<n>
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --first-revocation-at=<iso>
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --evidence-rows-captured=<n>
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --dry-run
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --templates-dir=<path>
 *   node scripts/deploy/playbooks/playbook-lineage.mjs --output-dir=<path>
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function arg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(`--${name}=`.length) : fallback;
}

const TEMPLATES_DIR = arg('templates-dir', resolve(ROOT, 'docs/deployment/playbooks/templates'));
const LINEAGE_DIR = arg('output-dir', resolve(ROOT, '.playbook-lineage'));
const DEPLOY_LINEAGE_DIR = resolve(ROOT, '.deployment-lineage');

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function findTemplateFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) continue;
    if (!entry.endsWith('.md')) continue;
    out.push(full);
  }
  return out.sort();
}

function extractFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') return null;
  const closeIdx = lines.indexOf('---', 1);
  if (closeIdx < 0) return null;
  const fm = {};
  for (const line of lines.slice(1, closeIdx)) {
    const m = line.match(/^([a-z_][a-z0-9_]*):\s*(.+)$/i);
    if (!m) continue;
    fm[m[1]] = m[2].trim();
  }
  return fm;
}

function readDeploymentManifestId() {
  if (!process.argv.includes('--link-deploy')) return null;
  const p = resolve(DEPLOY_LINEAGE_DIR, 'latest.json');
  if (!existsSync(p)) {
    process.stderr.write('[playbook-lineage] --link-deploy requested but .deployment-lineage/latest.json absent; emitting null.\n');
    return null;
  }
  try {
    const m = JSON.parse(readFileSync(p, 'utf-8'));
    return m.manifestId ?? null;
  } catch {
    process.stderr.write('[playbook-lineage] --link-deploy requested but deployment manifest unparseable; emitting null.\n');
    return null;
  }
}

function readPreviousManifestId() {
  const p = resolve(LINEAGE_DIR, 'latest.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')).manifestId ?? null;
  } catch {
    return null;
  }
}

function computePlaybookSetHash() {
  const files = findTemplateFiles(TEMPLATES_DIR);
  if (files.length === 0) {
    process.stderr.write(`FATAL: no templates under ${TEMPLATES_DIR}\n`);
    process.exit(1);
  }
  const playbooks = [];
  const perFileLines = [];
  for (const full of files) {
    const content = readFileSync(full, 'utf-8');
    const relPath = relative(ROOT, full);
    const fileHash = sha256(content);
    const fm = extractFrontmatter(content);
    playbooks.push({
      playbookId: fm?.playbook_id ?? '<no-frontmatter>',
      version: fm?.version ? Number.parseInt(fm.version, 10) : null,
      hash: fileHash,
    });
    perFileLines.push(`${relPath}\t${fileHash}`);
  }
  return {
    playbookSetHash: sha256(perFileLines.join('\n') + '\n'),
    playbookCount: playbooks.length,
    playbookManifests: playbooks,
  };
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'no-git';
  }
}

function operatorIdentity() {
  return arg('operator') || process.env.GITHUB_ACTOR || process.env.USER || 'unknown';
}

function parseIntArg(name) {
  const v = arg(name);
  if (v === undefined) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function buildManifest() {
  const { playbookSetHash, playbookCount, playbookManifests } = computePlaybookSetHash();
  const buildTimestampUtc = arg('timestamp') || new Date().toISOString();
  const chaosFingerprint = arg('chaos-fingerprint') || 'CHAOS_NOT_RUN';
  const deploymentManifestId = readDeploymentManifestId();
  const previousManifestId = readPreviousManifestId();

  const metrics = {
    time_to_first_credential: parseIntArg('time-to-first-credential'),
    reviewer_handoff_count: parseIntArg('reviewer-handoff-count'),
    first_revocation_at: arg('first-revocation-at') ?? null,
    evidence_rows_captured: parseIntArg('evidence-rows-captured'),
  };

  const body = {
    schema: 'vitalcv.playbook-lineage.v1',
    playbookSetHash,
    playbookCount,
    playbookManifests,
    deploymentManifestId,
    gitSha: gitSha(),
    operator: operatorIdentity(),
    buildTimestampUtc,
    chaosFingerprint,
    previousManifestId,
    metrics,
  };
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

if (!existsSync(LINEAGE_DIR)) {
  mkdirSync(LINEAGE_DIR, { recursive: true });
}

const safeTs = manifest.buildTimestampUtc.replace(/[:.]/g, '-');
const fileName = `${manifest.gitSha.slice(0, 12)}-${safeTs}.json`;
const filePath = resolve(LINEAGE_DIR, fileName);
const latestPath = resolve(LINEAGE_DIR, 'latest.json');

writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(latestPath, JSON.stringify(manifest, null, 2) + '\n');

process.stderr.write(
  `[playbook-lineage] wrote ${fileName} ` +
  `(manifestId=${manifest.manifestId.slice(0, 12)}…, setHash=${manifest.playbookSetHash.slice(0, 12)}…)\n`
);
process.stdout.write(
  JSON.stringify({ ok: true, manifestId: manifest.manifestId, path: fileName }, null, 2) + '\n'
);
