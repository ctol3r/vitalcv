#!/usr/bin/env node
// CSS census for apps/web — selectors defined, importing routes, dead-selector heuristic.
// Run from the repo root of the worktree: node css-census.mjs <repo-root>
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node css-census.mjs <repo-root>'); process.exit(1); }
const WEB = join(ROOT, 'apps/web');

function walk(dir, exts, skip = ['node_modules', '.next', 'coverage', 'dist']) {
  const out = [];
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (skip.some((s) => e === s || e.startsWith('.next'))) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(p, exts, skip));
    else if (exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

const cssFiles = walk(WEB, ['.css']).filter((f) => !f.includes('lcov-report'));
const srcFiles = walk(WEB, ['.tsx', '.ts', '.jsx', '.js', '.mjs']);
const srcBlob = srcFiles.map((f) => ({ f, text: readFileSync(f, 'utf8') }));

// Strip comments and extract top-level selectors (before '{'), plus custom props.
function parseCss(text) {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = new Set();
  const customProps = new Set();
  const classNames = new Set();
  // custom properties defined
  for (const m of noComments.matchAll(/^\s*(--[a-zA-Z][\w-]*)\s*:/gm)) customProps.add(m[1]);
  // selector extraction: lines ending in '{' that aren't at-rules or property blocks
  let depth = 0;
  for (const rawLine of noComments.split('\n')) {
    const line = rawLine.trim();
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (opens > 0 && !line.startsWith('@') && depth === 0) {
      const sel = line.slice(0, line.indexOf('{')).trim();
      if (sel) {
        selectors.add(sel);
        for (const cm of sel.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classNames.add(cm[1]);
      }
    }
    depth += opens - closes;
    if (depth < 0) depth = 0;
  }
  return { selectors, customProps, classNames };
}

// Which source files import this stylesheet (by filename)?
function findImporters(cssPath) {
  const name = basename(cssPath);
  const importers = [];
  for (const { f, text } of srcBlob) {
    if (text.includes(name)) importers.push(relative(WEB, f));
  }
  // also css @import chains
  for (const other of cssFiles) {
    if (other === cssPath) continue;
    const t = readFileSync(other, 'utf8');
    if (t.includes(basename(cssPath)) && /@import/.test(t)) importers.push(relative(WEB, other) + ' (@import)');
  }
  return importers;
}

// Dead-class heuristic: class name appears in no source file as a literal.
function deadClasses(classNames) {
  const dead = [];
  for (const c of classNames) {
    let used = false;
    for (const { text } of srcBlob) {
      if (text.includes(c)) { used = true; break; }
    }
    if (!used) dead.push(c);
  }
  return dead;
}

const report = [];
let totalSelectors = 0, totalProps = 0, totalDead = 0;
for (const css of cssFiles.sort()) {
  const text = readFileSync(css, 'utf8');
  const { selectors, customProps, classNames } = parseCss(text);
  const importers = findImporters(css);
  const dead = deadClasses(classNames);
  totalSelectors += selectors.size;
  totalProps += customProps.size;
  totalDead += dead.length;
  report.push({
    file: relative(WEB, css),
    bytes: text.length,
    selectors: selectors.size,
    customProps: customProps.size,
    classNames: classNames.size,
    importers,
    deadClasses: dead.sort(),
  });
}

// Global unique custom props + collision map (same prop defined in >1 file)
const propDefs = new Map();
for (const css of cssFiles) {
  const { customProps } = parseCss(readFileSync(css, 'utf8'));
  for (const p of customProps) {
    if (!propDefs.has(p)) propDefs.set(p, []);
    propDefs.get(p).push(relative(WEB, css));
  }
}
const collisions = [...propDefs.entries()].filter(([, files]) => new Set(files).size > 1);

console.log(JSON.stringify({
  generatedAgainst: 'origin/main',
  totals: {
    cssFiles: cssFiles.length,
    selectors: totalSelectors,
    uniqueCustomProps: propDefs.size,
    customPropDefinitions: totalProps,
    deadClassCandidates: totalDead,
    propsDefinedInMultipleFiles: collisions.length,
  },
  collisions: collisions.map(([p, files]) => ({ prop: p, files: [...new Set(files)] }))
    .sort((a, b) => b.files.length - a.files.length).slice(0, 40),
  files: report,
}, null, 2));
