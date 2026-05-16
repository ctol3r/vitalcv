#!/usr/bin/env node
/**
 * Playbook lineage replay — W2-PR114A.
 *
 * Given a playbook lineage manifest path (or 'latest'), recompute the
 * playbook-set digest from current sources and assert the manifest matches.
 *
 * Drift codes:
 *   PLAY-CLEAN       same setHash and integrity                          (exit 0)
 *   PLAY-DRIFT-SET   manifest setHash differs from current source        (exit 1)
 *   PLAY-DRIFT-ORPHAN  manifest file missing or previousManifestId absent (exit 1)
 *   PLAY-DRIFT-TAMPER  manifestId != sha256(canonical body excluding it)  (exit 1)
 *   PLAY-DRIFT-MANIFEST  per-playbook hash differs from current source     (exit 1)
 *
 * Usage:
 *   node scripts/deploy/playbooks/playbook-replay.mjs
 *   node scripts/deploy/playbooks/playbook-replay.mjs --path=<file>
 *   node scripts/deploy/playbooks/playbook-replay.mjs --json
 *   node scripts/deploy/playbooks/playbook-replay.mjs --templates-dir=<path>
 *   node scripts/deploy/playbooks/playbook-replay.mjs --lineage-dir=<path>
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function arg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(`--${name}=`.length) : fallback;
}

const TEMPLATES_DIR = arg('templates-dir', resolve(ROOT, 'docs/deployment/playbooks/templates'));
const LINEAGE_DIR = arg('lineage-dir', resolve(ROOT, '.playbook-lineage'));

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

function recomputeSet() {
  const files = findTemplateFiles(TEMPLATES_DIR);
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
    return { ok: false, reason: 'previousManifestId set but lineage dir missing' };
  }
  const files = readdirSync(LINEAGE_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'latest.json'
  );
  for (const f of files) {
    try {
      const candidate = JSON.parse(readFileSync(resolve(LINEAGE_DIR, f), 'utf-8'));
      if (candidate.manifestId === manifest.previousManifestId) return { ok: true };
    } catch {
      /* skip */
    }
  }
  return {
    ok: false,
    reason: `previousManifestId ${manifest.previousManifestId} not found in ${LINEAGE_DIR}`,
  };
}

const jsonOnly = process.argv.includes('--json');
const path = arg('path', resolve(LINEAGE_DIR, 'latest.json'));

if (!existsSync(path)) {
  process.stdout.write(
    JSON.stringify({ ok: false, code: 'PLAY-DRIFT-ORPHAN', reason: `manifest not found at ${path}` }, null, 2) + '\n'
  );
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(path, 'utf-8'));
} catch (err) {
  process.stdout.write(
    JSON.stringify({ ok: false, code: 'PLAY-DRIFT-TAMPER', reason: `manifest parse failed: ${err.message}` }, null, 2) + '\n'
  );
  process.exit(1);
}

const integrity = verifyManifestIntegrity(manifest);
if (!integrity.ok) {
  process.stdout.write(
    JSON.stringify({ ok: false, code: 'PLAY-DRIFT-TAMPER', reason: integrity.reason }, null, 2) + '\n'
  );
  process.exit(1);
}

const chain = checkLineageChain(manifest);
if (!chain.ok) {
  process.stdout.write(
    JSON.stringify({ ok: false, code: 'PLAY-DRIFT-ORPHAN', reason: chain.reason }, null, 2) + '\n'
  );
  process.exit(1);
}

const recomputed = recomputeSet();
if (manifest.playbookSetHash !== recomputed.playbookSetHash) {
  // Diagnose: is it set-level or per-playbook?
  const perFileMismatches = [];
  const recMap = new Map(recomputed.playbookManifests.map((p) => [p.playbookId, p]));
  for (const claimed of manifest.playbookManifests || []) {
    const live = recMap.get(claimed.playbookId);
    if (!live) {
      perFileMismatches.push({ playbookId: claimed.playbookId, reason: 'absent in current source' });
      continue;
    }
    if (live.hash !== claimed.hash) {
      perFileMismatches.push({
        playbookId: claimed.playbookId,
        manifestHash: claimed.hash,
        sourceHash: live.hash,
      });
    }
  }
  const code = perFileMismatches.length > 0 ? 'PLAY-DRIFT-MANIFEST' : 'PLAY-DRIFT-SET';
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        code,
        reason: `playbookSetHash drift (manifest=${manifest.playbookSetHash.slice(0, 12)}, source=${recomputed.playbookSetHash.slice(0, 12)})`,
        perFileMismatches,
      },
      null,
      2
    ) + '\n'
  );
  process.exit(1);
}

const report = {
  ok: true,
  code: 'PLAY-CLEAN',
  manifestId: manifest.manifestId,
  manifestPlaybookSetHash: manifest.playbookSetHash,
  recomputedPlaybookSetHash: recomputed.playbookSetHash,
  playbookCount: recomputed.playbookCount,
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!jsonOnly) {
  process.stderr.write(`[playbook-replay] PLAY-CLEAN — manifest matches current source (${recomputed.playbookCount} playbooks)\n`);
}
process.exit(0);
