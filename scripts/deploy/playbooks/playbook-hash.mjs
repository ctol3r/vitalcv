#!/usr/bin/env node
/**
 * Playbook set hash — W2-PR114A.
 *
 * Computes a deterministic SHA-256 digest over every .md file under
 * docs/deployment/playbooks/templates/. Re-running on the same source emits
 * the same digest; that property is the load-bearing piece of replay-safety.
 *
 * Output (default, --bare):
 *   <64-char hex digest>
 *
 * Output (--json):
 *   {
 *     ok: true,
 *     playbookSetHash: "<hex>",
 *     playbookCount: <int>,
 *     playbooks: [{ playbookId, version, path, hash }]
 *   }
 *
 * Exit codes:
 *   0 = digest computed
 *   1 = no templates found, or a template is unreadable
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
function arg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(`--${name}=`.length) : fallback;
}
const TEMPLATES_DIR = arg('templates-dir', resolve(ROOT, 'docs/deployment/playbooks/templates'));

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
  // Frontmatter is bounded by the first two lines of '---' separators.
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return null;
  }
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

function bare() {
  return process.argv.includes('--bare');
}

function jsonOut() {
  return process.argv.includes('--json');
}

const files = findTemplateFiles(TEMPLATES_DIR);
if (files.length === 0) {
  process.stderr.write(`FATAL: no playbook templates found under ${TEMPLATES_DIR}\n`);
  process.exit(1);
}

const playbooks = [];
const perFileLines = [];
for (const full of files) {
  let content;
  try {
    content = readFileSync(full, 'utf-8');
  } catch (err) {
    process.stderr.write(`FATAL: unreadable template ${full}: ${err.message}\n`);
    process.exit(1);
  }
  const relPath = relative(ROOT, full);
  const fileHash = sha256(content);
  const fm = extractFrontmatter(content);
  const playbookId = fm?.playbook_id ?? '<no-frontmatter>';
  const version = fm?.version ? Number.parseInt(fm.version, 10) : null;
  playbooks.push({ playbookId, version, path: relPath, hash: fileHash });
  perFileLines.push(`${relPath}\t${fileHash}`);
}

const concatenated = perFileLines.join('\n') + '\n';
const playbookSetHash = sha256(concatenated);

if (jsonOut()) {
  process.stdout.write(
    JSON.stringify(
      { ok: true, playbookSetHash, playbookCount: playbooks.length, playbooks },
      null,
      2
    ) + '\n'
  );
  process.exit(0);
}

if (bare()) {
  process.stdout.write(playbookSetHash + '\n');
  process.exit(0);
}

process.stderr.write(`[playbook-hash] count=${playbooks.length} set=${playbookSetHash.slice(0, 12)}…\n`);
for (const p of playbooks) {
  process.stderr.write(`  ${p.playbookId.padEnd(36)} v${String(p.version ?? '?').padStart(2)} ${p.hash.slice(0, 12)}…\n`);
}
process.stdout.write(playbookSetHash + '\n');
process.exit(0);
