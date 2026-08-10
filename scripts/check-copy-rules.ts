#!/usr/bin/env tsx
/**
 * check-copy-rules — the EC-9 customer-facing VOCABULARY gate.
 *
 * Rules live in `scripts/copy-rules.json`; this file is only the engine.
 *
 * WHY THIS EXISTS
 * The 2026-08-09 page-consistency audit found 38 phrase×page EC-9 hits and named the root cause:
 * `copy-rules.json` did not exist, so the ban had only ever been advisory. Every EC-23 contract that
 * HAS a gate was holding; every ungated one recurred verbatim across audits. This is the gate.
 *
 * NOT A DUPLICATE of scripts/check-public-claims.ts. That guards the TRUTH CONTRACT (over-claims:
 * "HIPAA compliant", bare "Verified"). This guards VOCABULARY (internal nouns leaking into customer
 * copy). A phrase belongs in exactly one of them.
 *
 * THREE DESIGN DECISIONS, each answering a way a previous scan in this repo was defeated:
 *
 *   1. It matches ACROSS LINES. A JSX text node that wraps ("…review-ready proof\n  packet…") is
 *      one segment here, not two lines. A line-by-line scanner reports clean on wrapped copy — that
 *      has happened, and injection proofs passed against a scan that could not see the bug.
 *
 *   2. It scans PROSE, not source. Only JSX text nodes, prose string literals, and copy-bearing JSX
 *      attributes are searched. `PacketFieldEntry`, `import … from '@/lib/matcha'` and
 *      `/holder/home` are code and route identifiers — matching them would produce hundreds of
 *      false positives, the gate would get muted, and we would be back to advisory.
 *
 *   3. It is CASE-INSENSITIVE. A label built at runtime via `.toUpperCase()` is invisible to a
 *      case-sensitive scan of its source string. 45 such sites once shipped a bare "VERIFIED".
 *
 * RATCHET
 * The gate ships red-safe: `scripts/copy-rules-baseline.json` records today's known debt per
 * (file, tier, term). CI fails on any NEW or INCREASED violation, never on the standing baseline.
 * As sweeps land, run `--update-baseline` to lower the ceiling. It only ever goes down.
 *
 * Usage:
 *   pnpm check:copy                    # gate (exit 1 on regression)
 *   pnpm check:copy --update-baseline  # re-record after a sweep
 *   pnpm check:copy --all              # report the full standing debt, ignoring the baseline
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createRequire } from 'node:module';

const ts: typeof import('typescript') = createRequire(import.meta.url)('typescript');

const repoRoot = process.cwd();
const RULES_PATH = join(repoRoot, 'scripts', 'copy-rules.json');
const BASELINE_PATH = join(repoRoot, 'scripts', 'copy-rules-baseline.json');

const argv = new Set(process.argv.slice(2));
const UPDATE_BASELINE = argv.has('--update-baseline');
const SHOW_ALL = argv.has('--all');

// ---------------------------------------------------------------- rules

interface Term { term: string; fix: string; allowWithin?: string[]; allowNote?: string }
interface Tier {
  id: number;
  name: string;
  appliesTo: string;
  waivedOn?: string[];
  description: string;
  terms: Term[];
}
interface Rules {
  protectedTruthQualifiers: { description: string[]; patterns: string[] };
  surfaces: Record<string, { description: string; globs: string[] }>;
  tiers: Tier[];
  legalPlainLanguage: { appliesTo: string; description: string; terms: Term[] };
  scan: {
    roots: string[];
    extensions: string[];
    excludeDirs: string[];
    excludeFilePatterns: string[];
    excludePathPatterns?: string[];
  };
}

const rules: Rules = JSON.parse(readFileSync(RULES_PATH, 'utf8'));

// ---------------------------------------------------------------- glob

/** Minimal glob: `**` spans path segments, `*` does not. Paths are posix-normalised. */
function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if ('\\^$+?.()|{}[]'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

const surfaceMatchers: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(rules.surfaces).map(([name, def]) => [name, def.globs.map(globToRegExp)]),
);

function surfacesFor(relPath: string): Set<string> {
  const posix = relPath.split(sep).join('/');
  const found = new Set<string>();
  for (const [name, matchers] of Object.entries(surfaceMatchers)) {
    if (matchers.some((re) => re.test(posix))) found.add(name);
  }
  return found;
}

// ---------------------------------------------------------------- prose extraction

interface Segment { text: string; pos: number }

/**
 * Prose is extracted from the TypeScript AST, never by regex.
 *
 * A first cut of this gate used `/>([^<>{}]+)</` to find JSX text and produced 825 "violations",
 * most of them nonsense — in TSX, `>` and `<` also close arrow functions, open generics and compare
 * numbers, so the pattern happily bracketed arbitrary code (`d.laneId === lane.laneId); const …`).
 * A gate that cries wolf gets muted, and a muted gate is how EC-9 became advisory in the first
 * place. So: real parsing.
 */

/** JSX attributes whose value is machinery, never copy. */
const NON_COPY_ATTRS = new Set([
  'className', 'class', 'style', 'id', 'key', 'href', 'src', 'srcSet', 'type', 'name', 'role',
  'rel', 'target', 'htmlFor', 'value', 'defaultValue', 'method', 'action', 'as', 'variant',
  'testId', 'data-testid', 'dataTestId', 'slug', 'path', 'fill', 'stroke', 'viewBox', 'd',
]);

/** JSX attributes whose value is copy by definition, even when it is a single word. */
const COPY_ATTRS = new Set([
  'title', 'label', 'aria-label', 'ariaLabel', 'placeholder', 'alt', 'heading', 'subheading',
  'subtitle', 'eyebrow', 'description', 'caption', 'cta', 'ctaLabel', 'summary', 'tooltip',
  'legend', 'headline', 'body', 'text', 'message', 'hint', 'note',
]);

function attrNameOf(node: import('typescript').Node): string | null {
  const parent = node.parent;
  if (parent && ts.isJsxAttribute(parent)) return parent.name.getText();
  // value={cond ? 'a' : 'b'} and value={`…`} sit inside a JsxExpression
  if (parent && ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText();
  }
  return null;
}

function isModuleSpecifier(node: import('typescript').Node): boolean {
  const p = node.parent;
  if (!p) return false;
  return (
    (ts.isImportDeclaration(p) && p.moduleSpecifier === node) ||
    (ts.isExportDeclaration(p) && p.moduleSpecifier === node) ||
    ts.isImportTypeNode(p) ||
    (ts.isCallExpression(p) && p.expression.getText() === 'require')
  );
}

function extractProse(src: string, fileName: string): Segment[] {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const segments: Segment[] = [];

  const push = (text: string, pos: number) => {
    if (/[A-Za-z]/.test(text) && !looksLikeStyleBlob(text)) segments.push({ text, pos });
  };

  /**
   * A CSS blob in a template literal is not copy. `design-wave1505/styles.ts` declares
   * `--matcha-800: #2c3e2d;` twenty times; those are design tokens, not the codename appearing in
   * front of a clinician. Token names are governed by UX-02, not EC-9.
   */
  const looksLikeStyleBlob = (text: string): boolean =>
    /--[a-z0-9-]+\s*:/i.test(text) ||
    /[{;]\s*[a-z-]+\s*:\s*[^;{]+;/i.test(text) ||
    /@(?:media|keyframes|supports|import|font-face)\b/.test(text);

  const visit = (node: import('typescript').Node): void => {
    if (ts.isJsxText(node)) {
      // JSX text nodes span newlines by construction — this is what makes wrapped copy visible.
      if (node.text.trim()) push(node.text, node.getStart(sf));
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (!isModuleSpecifier(node)) {
        const attr = attrNameOf(node);
        if (attr === null || !NON_COPY_ATTRS.has(attr)) {
          // A spaceless literal is overwhelmingly an identifier, route or token — decision (2).
          // Copy-bearing attributes are exempt from that rule: title="Matches" is copy.
          if (/\s/.test(node.text) || (attr !== null && COPY_ATTRS.has(attr))) {
            push(node.text, node.getStart(sf));
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return segments;
}

// ---------------------------------------------------------------- matching

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `proof packet` also matches `proof\n  packet` and `proof  packet`. Case-insensitive. */
function looseRegex(term: string): RegExp {
  const parts = term.trim().split(/\s+/).map(escapeRe);
  return new RegExp(`\\b${parts.join('[\\s\\u00a0]+')}\\b`, 'gi');
}

interface CompiledTerm extends Term {
  re: RegExp;
  allowRes: RegExp[];
  tierId: number | 'legal';
  tierName: string;
}

const compile = (t: Term, tierId: number | 'legal', tierName: string): CompiledTerm => ({
  ...t,
  re: looseRegex(t.term),
  allowRes: (t.allowWithin ?? []).map(looseRegex),
  tierId,
  tierName,
});

const compiled: CompiledTerm[] = [
  ...rules.tiers.flatMap((tier) => tier.terms.map((t) => compile(t, tier.id, tier.name))),
  ...rules.legalPlainLanguage.terms.map((t) => compile(t, 'legal', 'legal-plain-language')),
];

/**
 * Ranges in `text` covered by a ratified phrase that legitimately contains the banned term.
 * "Provider Career Evidence Network" is the company's own name; "evidence network" inside it is
 * not a violation. Without this, the gate flags the brand and gets switched off.
 */
function allowedRanges(term: CompiledTerm, text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const re of term.allowRes) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function appliesTo(term: CompiledTerm, surfaces: Set<string>): boolean {
  if (term.tierId === 'legal') return surfaces.has('legal');
  const tier = rules.tiers.find((t) => t.id === term.tierId)!;
  if ((tier.waivedOn ?? []).some((s) => surfaces.has(s))) return false;
  if (tier.appliesTo === 'all-customer-facing') return true;
  return surfaces.has(tier.appliesTo);
}

// ---------------------------------------------------------------- walk

const EXCLUDE_DIRS = new Set(rules.scan.excludeDirs);
const EXCLUDE_FILE = rules.scan.excludeFilePatterns.map((p) => new RegExp(p));
const EXCLUDE_PATH = (rules.scan.excludePathPatterns ?? []).map((p) => new RegExp(p));
const PROTECTED = rules.protectedTruthQualifiers.patterns.map((p) => new RegExp(p, 'i'));
const EXTS = new Set(rules.scan.extensions);

interface Hit {
  file: string;
  line: number;
  term: string;
  fix: string;
  tier: number | 'legal';
  tierName: string;
  context: string;
}

const hits: Hit[] = [];

function lineOf(src: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

function scanFile(abs: string): void {
  const rel = relative(repoRoot, abs);
  const posix = rel.split(sep).join('/');
  if (EXCLUDE_FILE.some((re) => re.test(rel))) return;
  if (EXCLUDE_PATH.some((re) => re.test(posix))) return;
  const dot = rel.lastIndexOf('.');
  if (dot < 0 || !EXTS.has(rel.slice(dot))) return;

  let src: string;
  try {
    src = readFileSync(abs, 'utf8');
  } catch {
    return;
  }

  const surfaces = surfacesFor(rel);
  const active = compiled.filter((t) => appliesTo(t, surfaces));
  if (active.length === 0) return;

  for (const seg of extractProse(src, rel)) {
    // A truth qualifier is not vocabulary. Exempt the whole segment before any term is tested —
    // see copy-rules.json §protectedTruthQualifiers. The truth contract outranks the word list.
    if (PROTECTED.some((re) => re.test(seg.text))) continue;
    for (const term of active) {
      const allowed = allowedRanges(term, seg.text);
      term.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = term.re.exec(seg.text)) !== null) {
        const at = m.index;
        if (allowed.some(([s, e]) => at >= s && at < e)) continue;
        const absIndex = seg.pos + at;
        hits.push({
          file: rel,
          line: lineOf(src, absIndex),
          term: term.term,
          fix: term.fix,
          tier: term.tierId,
          tierName: term.tierName,
          context: seg.text.replace(/\s+/g, ' ').trim().slice(0, 140),
        });
      }
    }
  }
}

function walk(dir: string): void {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(join(dir, e.name));
    } else if (e.isFile()) {
      scanFile(join(dir, e.name));
    }
  }
}

// ---------------------------------------------------------------- run

console.log('check-copy-rules — EC-9 customer-facing vocabulary gate\n');
for (const root of rules.scan.roots) {
  const abs = join(repoRoot, root);
  try {
    statSync(abs);
  } catch {
    console.log(`  (skip, not found) ${root}`);
    continue;
  }
  console.log(`  scanning ${root}`);
  walk(abs);
}
console.log('');

const key = (h: Hit) => `${h.file.split(sep).join('/')}::${h.tier}::${h.term}`;
const counts = new Map<string, number>();
for (const h of hits) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1);

interface Baseline { generatedAgainst: string; total: number; entries: Record<string, number> }
let baseline: Baseline = { generatedAgainst: 'none', total: 0, entries: {} };
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  /* first run */
}

if (UPDATE_BASELINE) {
  const entries = Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const next: Baseline = {
    generatedAgainst: process.env.GITHUB_SHA ?? 'local',
    total: hits.length,
    entries,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Baseline written: ${hits.length} standing violation(s) across ${counts.size} (file, term) pair(s).`);
  console.log(`  ${relative(repoRoot, BASELINE_PATH)}`);
  process.exit(0);
}

const regressions = hits.filter((h) => {
  const k = key(h);
  return (counts.get(k) ?? 0) > (baseline.entries[k] ?? 0);
});
const seen = new Set<string>();
const uniqueRegressions = regressions.filter((h) => {
  const k = key(h);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (SHOW_ALL) {
  console.log(`Standing debt — ${hits.length} violation(s) across ${counts.size} (file, term) pair(s):\n`);
  for (const [k, n] of [...counts.entries()].sort(([, a], [, b]) => b - a)) {
    console.log(`  ${String(n).padStart(3)} × ${k}`);
  }
  console.log('');
}

const improved = Object.entries(baseline.entries).filter(([k, n]) => (counts.get(k) ?? 0) < n);

if (uniqueRegressions.length === 0) {
  console.log(`PASS — no new EC-9 vocabulary violations.`);
  console.log(`  standing baseline: ${baseline.total} violation(s) across ${Object.keys(baseline.entries).length} pair(s)`);
  console.log(`  measured now:      ${hits.length} violation(s) across ${counts.size} pair(s)`);
  if (improved.length > 0) {
    console.log(`\n  ${improved.length} pair(s) improved. Lower the ceiling:  pnpm check:copy --update-baseline`);
  }
  process.exit(0);
}

console.error(`FAIL — ${uniqueRegressions.length} new or increased EC-9 vocabulary violation(s):\n`);
for (const h of uniqueRegressions) {
  const k = key(h);
  const was = baseline.entries[k] ?? 0;
  console.error(`  ${h.file}:${h.line}   [tier ${h.tier} · ${h.tierName}]`);
  console.error(`    term:  "${h.term}"   (baseline ${was} → now ${counts.get(k)})`);
  console.error(`    fix:   ${h.fix}`);
  console.error(`    copy:  ${h.context}`);
  console.error('');
}
console.error('Rules: scripts/copy-rules.json · Authority: EC-9 + founder ruling D-I');
console.error('This gate ratchets. It never fails on standing debt — only on new debt.');
process.exit(1);
