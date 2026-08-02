/**
 * check-design-lint — DG-18.4 design-lint rules, enforced in CI.
 *
 * Source: `wave1505/DESIGN_LINT.md` from the 2026-07-12 Claude Design handoff
 * bundle, adapted to this repository. The canonical, repo-specific rule text
 * lives in `docs/design/DESIGN_LINT.md`.
 *
 * WHY THIS IS NOT A STRAIGHT PORT. The handoff's rules were written for a
 * greenfield implementation of the design system. Measured against this
 * codebase on 2026-07-22 they would have failed on arrival:
 *
 *     LINT-01 raw color          117 existing
 *     LINT-02 raw lucide         326 existing
 *     LINT-03 @keyframes         117 existing
 *     LINT-05 literal z-index     27 existing
 *     LINT-06 shadow/radius       37 existing
 *     LINT-09 font-family          8 existing
 *
 * A gate that is red the day it lands teaches everyone to ignore it. So each
 * rule carries a MODE:
 *
 *   'error'   — must be zero. Used where the codebase is already clean, and
 *               for the COMPETE composition rules, which are new contract.
 *   'ratchet' — a measured baseline in design-lint-baseline.json that may
 *               shrink but never grow. This stops the bleeding honestly
 *               instead of pretending the debt is not there.
 *
 * Ratchets are not permanent. Lower the baseline as debt is paid; the gate
 * fails if a baseline is set below the real count, so it cannot drift up.
 *
 * Usage:
 *   pnpm check:design            # enforce
 *   pnpm check:design --update   # rewrite baselines (review the diff!)
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const web = join('apps', 'web');
const BASELINE_PATH = join(repoRoot, 'scripts', 'design-lint-baseline.json');
const UPDATE = process.argv.includes('--update');

type Mode = 'error' | 'ratchet';

interface Rule {
  id: string;
  mode: Mode;
  what: string;
  fix: string;
  /** Repo-relative roots to walk. */
  roots: string[];
  exts: string[];
  /** Strip comments before matching — rules that DOCUMENT themselves must not trip. */
  stripComments?: boolean;
  pattern: RegExp;
  /** Return true to exempt a hit. */
  allow?: (file: string, line: string) => boolean;
}

const TSX = ['.ts', '.tsx', '.js', '.jsx'];
const CSS = ['.css'];

/** Paths that legitimately define what everything else may only reference. */
const TOKEN_FILES = [
  join(web, 'styles', 'tokens.css'),
  join(web, 'styles', 'theme.css'),
  join(web, 'app', 'globals.css'),
];
const isTokenFile = (f: string) => TOKEN_FILES.some((t) => f === t);

/**
 * OKLCH hue + chroma of the first colour literal on a line, or null when there
 * isn't one (a `var()`, `color-mix()`, or bare keyword). Used by CD-3/4, which
 * has to make a NUMERIC judgement — "is this token green?" — that a regex
 * cannot make. Node built-ins only, in keeping with the rest of this script.
 */
function colorOf(line: string): { C: number; H: number } | null {
  const ok = /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(line);
  if (ok) return { C: Number(ok[2]), H: Number(ok[3]) };

  const hex = /#([0-9a-fA-F]{6})\b/.exec(line);
  if (!hex) return null;
  const n = hex[1];
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(n.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return { C: Math.hypot(A, B), H: H < 0 ? H + 360 : H };
}

/**
 * The COMPETE composition rules (R1–R8) from
 * docs/strategy/competitive-mandate.md. These are NEW contract, scoped to the
 * homepage surfaces, so they are hard errors rather than ratchets.
 */
const FILM_ROOTS = [join(web, 'components', 'home', 'film')];

/**
 * The LIVE `/` has not adopted the composition contract yet — COMPETE-1 built
 * the film but deliberately did not switch production routing. So the same
 * rules apply here as RATCHETS: today's violations are recorded and may not
 * grow, and they go to zero when `/` switches to HorizontalCareerFilm.
 *
 * Current known debt: HomePageClient still mounts MetricStrip, which the C5
 * ruling retires (docs/design/homepage-composition-ownership.md).
 */
const LEGACY_HOME_ROOTS = [
  join(web, 'app', 'HomePageClient.tsx'),
  join(web, 'app', 'page.tsx'),
];
const HOMEPAGE_ROOTS = [...FILM_ROOTS, ...LEGACY_HOME_ROOTS];

const RULES: Rule[] = [
  {
    id: 'LINT-01',
    mode: 'ratchet',
    what: 'Raw color outside token files',
    fix: 'Use a --vt-* token. Raw color belongs only in styles/tokens.css or a brand asset.',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /(?:color|background|border|fill|stroke|shadow|outline)[a-z-]*\s*:[^;]*(?:#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\()/,
    allow: (f) => isTokenFile(f),
  },
  {
    id: 'LINT-02',
    mode: 'ratchet',
    what: 'Raw lucide-react import outside the Icon wrapper',
    fix: 'Import through components/Icon — the glyph set is closed. TrustGlyph is the ONLY state iconography.',
    roots: [join(web, 'app'), join(web, 'components')],
    exts: TSX,
    stripComments: true,
    pattern: /from\s+['"]lucide-react['"]/,
    allow: (f) => f.endsWith(join('components', 'Icon.tsx')),
  },
  {
    id: 'LINT-03',
    mode: 'ratchet',
    what: '@keyframes outside the house motion file',
    fix: 'Add it to styles/motion.css with a CHANGES.md entry, or reuse an existing house animation.',
    roots: [join(web, 'app'), join(web, 'components'), join(web, 'styles')],
    exts: [...CSS, ...TSX],
    pattern: /@keyframes\b/,
    allow: (f) => f === join(web, 'styles', 'motion.css'),
  },
  {
    id: 'LINT-04',
    mode: 'error',
    what: 'Dark/ops token on a public route',
    fix: 'Ops chrome belongs on ops surfaces. Public routes are paper.',
    roots: [join(web, 'app')],
    exts: [...TSX, ...CSS],
    stripComments: true,
    pattern: /data-theme=["']ops["']|--vt-surface-inverse|var\(--ink-950\)/,
    allow: (f) =>
      /[\\/](ops|admin|intelligence|operations-engine|mission-ops|system-health)[\\/]/.test(f) ||
      f.endsWith('publicSurfaceRoutes.ts'),
  },
  {
    id: 'LINT-05',
    mode: 'ratchet',
    what: 'Literal z-index',
    fix: 'Use a --vt-z-* stop. A seventh stop requires a CHANGES.md entry.',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /z-index\s*:\s*-?\d/,
    allow: (f) => isTokenFile(f),
  },
  {
    id: 'LINT-06',
    mode: 'ratchet',
    what: 'box-shadow that is not none or a token',
    fix: 'Use var(--vt-lift) or var(--vt-focus-ring).',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /box-shadow\s*:\s*(?!\s*(?:none|var\(|inherit|initial|unset))/,
    allow: (f) => isTokenFile(f),
  },
  {
    id: 'LINT-08',
    mode: 'error',
    what: 'Prohibited marketing copy',
    fix: 'Remove the claim. See docs/design/DESIGN_LINT.md LINT-08.',
    roots: [join(web, 'app'), join(web, 'components')],
    exts: TSX,
    pattern:
      /\b(cheapest|guaranteed\s+(?:roi|results)|as seen in|trusted by \d|100%\s+(?:secure|verified)|blockchain-verified|bank-level)\b/i,
    allow: (_f, line) => /\bno\b|\bnever\b|\bwithout\b|\bprohibit/i.test(line),
  },
  {
    id: 'LINT-09',
    mode: 'ratchet',
    what: 'font-family literal',
    fix: 'Use var(--font-display | --font-body | --font-mono).',
    roots: [join(web, 'styles')],
    exts: CSS,
    pattern: /font-family\s*:\s*(?!\s*var\()/,
    allow: (f) => isTokenFile(f) || f.endsWith('fonts.css'),
  },
  {
    id: 'CD-3/4',
    mode: 'error',
    what: 'Cool ink/paper token, or an accent borrowed from a state hue',
    fix: 'Ink, paper and rule are WARM (CD-4). The accent is indigo and is never a state colour (CD-3) — green means one thing: a named source returned a match.',
    roots: [join(web, 'styles')],
    exts: CSS,
    stripComments: true,
    // Guard the settled local names and the actual global light-theme tokens.
    // Do not sweep every legacy `--vt-surface-*` island: ops/base/sunken tokens
    // intentionally live in other palettes and are separate consolidation debt.
    pattern:
      /--(?:(?:ink|paper|rule|accent)[a-z0-9-]*|vt-(?:cloud-dancer|bg|surface(?:-(?:subtle|dim))?|border(?:-subtle)?|accent(?:-(?:editorial|hover))?))\s*:[^;]*(?:#[0-9a-fA-F]{3,8}\b|oklch\()/,
    allow: (_f, line) => {
      const c = colorOf(line);
      if (!c) return true;
      // `--vt-accent` and `--vt-accent-hover` are the ink action pair in the
      // current system. The chromatic editorial signal is explicitly named;
      // unprefixed --accent* tokens remain governed as editorial accents too.
      const isAccent = /--(?:accent[a-z0-9-]*|vt-accent-editorial)\s*:/.test(line);
      if (c.C <= (isAccent ? 0.006 : 0.004)) return true;
      return isAccent ? c.H >= 255 && c.H <= 310 : c.H >= 30 && c.H <= 110;
    },
  },
  {
    id: 'R1',
    mode: 'error',
    what: 'Graph vocabulary or node/edge drawing on a homepage surface',
    fix: 'The homepage is not a public career graph. Evidence appears as fragments, receipts, and source light — never nodes, edges, or a constellation.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /\bconstellation\b|\bforceGraph\b|\.lineTo\(|\.moveTo\(|drag to rotate/i,
  },
  {
    id: 'R2',
    mode: 'error',
    what: 'Rolodex, carousel, or wide card queue on a homepage surface',
    fix: 'The scene itself must change. A card deck is a product tour, not a film.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /\bRolodex\b|\bCarousel\b|scroll-snap-type|\bJourneyCard\b|HorizontalStoryRail/i,
  },
  {
    id: 'R4',
    mode: 'error',
    what: 'Metric theatre in the film',
    fix: 'No counters, 01–06 step numbering, or percentage rings. Animate only returned personal state.',
    roots: FILM_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /AnimatedMetricValue|\bReadinessRing\b|\bMetricStrip\b|role\s*[=:]\s*["']meter["']/,
  },
  {
    id: 'R4-legacy',
    mode: 'ratchet',
    what: 'Metric theatre on the un-migrated `/`',
    fix: 'Clears when `/` switches to HorizontalCareerFilm (C5 retires MetricStrip).',
    roots: LEGACY_HOME_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /AnimatedMetricValue|\bReadinessRing\b|\bMetricStrip\b|role\s*[=:]\s*["']meter["']/,
  },
  {
    id: 'R7',
    mode: 'error',
    what: 'Retired legacy homepage copy',
    fix: 'Superseded by the outcome-first hero.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /Find the opportunity|VitalCV recognizes/i,
  },
  {
    id: 'R8',
    mode: 'error',
    what: 'A second page-level scroll owner on a homepage surface',
    fix: 'Exactly one scroll listener and one rAF drive the film. Consumers READ progress.',
    roots: HOMEPAGE_ROOTS,
    exts: TSX,
    stripComments: true,
    pattern: /addEventListener\(\s*["'](?:wheel|touchmove)["']|onWheel=/,
  },
];

const EXCLUDED_DIRS = new Set([
  'node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', '_archive', '__tests__', 'tests',
]);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

function walk(absPath: string, exts: string[], out: string[]): void {
  let st;
  try {
    st = statSync(absPath);
  } catch {
    return;
  }
  if (st.isFile()) {
    if (exts.some((e) => absPath.endsWith(e))) out.push(absPath);
    return;
  }
  if (!st.isDirectory()) return;
  for (const entry of readdirSync(absPath, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    walk(join(absPath, entry.name), exts, out);
  }
}

interface Hit { rule: Rule; file: string; line: number; text: string }

const hits: Hit[] = [];

for (const rule of RULES) {
  const files: string[] = [];
  for (const root of rule.roots) walk(join(repoRoot, root), rule.exts, files);

  for (const abs of files) {
    const rel = relative(repoRoot, abs).split(sep).join(sep);
    let source: string;
    try {
      source = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (rule.stripComments) source = stripComments(source);

    source.split('\n').forEach((line, i) => {
      if (!rule.pattern.test(line)) return;
      if (rule.allow?.(rel, line)) return;
      hits.push({ rule, file: rel, line: i + 1, text: line.trim().slice(0, 140) });
    });
  }
}

const counts = new Map<string, number>();
for (const h of hits) counts.set(h.rule.id, (counts.get(h.rule.id) ?? 0) + 1);

let baseline: Record<string, number> = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  baseline = {};
}

if (UPDATE) {
  const next: Record<string, number> = {};
  for (const rule of RULES) {
    if (rule.mode === 'ratchet') next[rule.id] = counts.get(rule.id) ?? 0;
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log('design-lint — baselines written to scripts/design-lint-baseline.json');
  for (const [id, n] of Object.entries(next)) console.log(`  ${id}  ${n}`);
  process.exit(0);
}

console.log('check-design-lint — DG-18.4 + COMPETE composition rules\n');

const failures: string[] = [];

for (const rule of RULES) {
  const n = counts.get(rule.id) ?? 0;

  if (rule.mode === 'error') {
    if (n === 0) {
      console.log(`  PASS   ${rule.id}  ${rule.what}`);
      continue;
    }
    failures.push(rule.id);
    console.log(`  FAIL   ${rule.id}  ${rule.what} — ${n} violation${n === 1 ? '' : 's'}`);
    for (const h of hits.filter((x) => x.rule.id === rule.id).slice(0, 8)) {
      console.log(`         ${h.file}:${h.line}  ${h.text}`);
    }
    console.log(`         fix: ${rule.fix}`);
    continue;
  }

  const base = baseline[rule.id];
  if (base === undefined) {
    failures.push(rule.id);
    console.log(`  FAIL   ${rule.id}  no baseline recorded — run \`pnpm check:design --update\``);
    continue;
  }
  if (n > base) {
    failures.push(rule.id);
    console.log(`  FAIL   ${rule.id}  ${rule.what} — ${n} now, baseline ${base} (+${n - base})`);
    for (const h of hits.filter((x) => x.rule.id === rule.id).slice(0, 6)) {
      console.log(`         ${h.file}:${h.line}  ${h.text}`);
    }
    console.log(`         fix: ${rule.fix}`);
  } else if (n < base) {
    console.log(`  PASS   ${rule.id}  ${n} (baseline ${base} — LOWER THE BASELINE: pnpm check:design --update)`);
  } else {
    console.log(`  HOLD   ${rule.id}  ${n} at baseline — ${rule.what}`);
  }
}

console.log();
if (failures.length > 0) {
  console.error(`design-lint FAILED: ${failures.join(', ')}`);
  console.error('See docs/design/DESIGN_LINT.md for each rule and its exceptions.');
  process.exit(1);
}
console.log(`design-lint PASS — ${RULES.length} rules checked.`);
