// Reimplements publicSurfaceRoutes.ts chrome resolution in plain JS so each
// reachable prod route can be classified by INTENDED chrome, then compared with
// what actually rendered. Sets are parsed out of the real source on origin/main
// rather than retyped, so the two cannot drift.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const src = execSync('git show origin/main:apps/web/components/layout/publicSurfaceRoutes.ts', {
  cwd: '/Users/christoler/vitalcv', encoding: 'utf8',
});

function block(startMarker) {
  // Anchor on the DECLARATION, not the first textual mention — several of these
  // names appear in explanatory comments earlier in the file.
  const i = src.search(new RegExp('(const|export const)\\s+' + startMarker + '\\b'));
  if (i < 0) throw new Error('missing ' + startMarker);
  const open = src.indexOf('[', i);
  let depth = 0, j = open;
  for (; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']') { depth--; if (depth === 0) break; }
  }
  const body = src.slice(open, j);
  // strip comments then pull quoted strings
  const clean = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const PUBLIC_EXACT = new Set(block('PUBLIC_SURFACE_PATHS'));
const OPS_PREFIXES = block('OPS_SURFACE_PREFIXES');
const OPS_EXEMPT = new Set(block('OPS_SURFACE_EXEMPTIONS'));
const PREFIXES = block('PREFIX_MATCHERS');

const isOps = (p) => !OPS_EXEMPT.has(p) && OPS_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));
const isPublic = (p) =>
  PUBLIC_EXACT.has(p) || /^\/activity\/.+/.test(p) || PREFIXES.some((x) => p === x || p.startsWith(x + '/'));

const probe = JSON.parse(readFileSync(new URL('./probe-main.json', import.meta.url), 'utf8'));
const rows = probe
  .filter((p) => p.status === 200)
  .map((p) => {
    const path = p.probed;
    const ops = isOps(path), pub = isPublic(path);
    return {
      path,
      ops, pub,
      expected: ops ? 'ops-shell' : pub ? 'navbar+footer' : 'NONE (unregistered)',
    };
  });

console.log('PUBLIC_EXACT:', PUBLIC_EXACT.size, '| OPS_PREFIXES:', OPS_PREFIXES.length, '| PREFIX_MATCHERS:', PREFIXES.length);
console.log();
const grouped = {};
for (const r of rows) (grouped[r.expected] ||= []).push(r.path);
for (const [k, v] of Object.entries(grouped)) {
  console.log(`--- ${k} (${v.length}) ---`);
  v.forEach((p) => console.log('   ' + p));
}
writeFileSync(new URL('./chrome-expected.json', import.meta.url), JSON.stringify(rows, null, 1));
