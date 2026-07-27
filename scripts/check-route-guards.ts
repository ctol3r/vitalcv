/**
 * check-route-guards — route-tree / guard-list drift, enforced in CI.
 *
 * WHY THIS EXISTS. `/employer/*` shipped to production with no route guard at
 * all (#908). The doctrine block at the top of `apps/web/lib/auth/roles.ts`
 * had classified it as a VERIFIER surface in prose since the file was written
 * — the pattern was simply never added to `PROTECTED_ROUTES`. Meanwhile
 * `/verifier/*`, an archived tree that 404s, *was* guarded. So the list
 * protected a dead route and left the live employer workspace answering 200 to
 * anonymous visitors. No test compared the prose to the array, and no test
 * compared either one to the routes actually served.
 *
 * A comment asserting a guard is not a guard. This script compares the three
 * things that must agree, in both directions:
 *
 *   1. the routes the app actually serves  (app/ ** /page.tsx)
 *   2. the guard patterns                  (PROTECTED_ROUTES)
 *   3. the public declarations             (PUBLIC_ROUTE_PATTERNS)
 *
 * It imports the REAL arrays rather than re-parsing them, so the gate reads
 * the same source of truth the middleware does and cannot drift from it.
 *
 * PROTECTION IS NOT ONLY `PROTECTED_ROUTES`. Some pages guard themselves with
 * an inline `auth()` / `currentUser()` call in the page or an ancestor layout
 * (`/admin/leads`, `/admin/platform`, `/ops` all do, and all correctly 307 to
 * sign-in). A gate that ignored that mechanism would report them as holes and
 * teach everyone to ignore it. Self-guarded routes are recognised and counted
 * separately — the gate's job is to find routes protected by NOTHING.
 *
 * Rule modes follow `check-design-lint`:
 *   'error'   — must be zero; blocks merge.
 *   'ratchet' — a measured baseline in route-guard-baseline.json that may
 *               shrink but never grow. The gate also fails if a baseline is
 *               set ABOVE the real count, so a fix cannot silently un-ratchet.
 *
 * Usage:
 *   pnpm check:routes            # enforce
 *   pnpm check:routes --update   # rewrite baselines (review the diff!)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  PROTECTED_ROUTES,
  PUBLIC_ROUTE_PATTERNS,
  ROLE_LANDING,
} from '../apps/web/lib/auth/roles.ts';

const repoRoot = resolve(import.meta.dirname, '..');
const APP_DIR = join(repoRoot, 'apps', 'web', 'app');
const BASELINE_PATH = join(repoRoot, 'scripts', 'route-guard-baseline.json');
const UPDATE = process.argv.includes('--update');

type Mode = 'error' | 'ratchet';

/** A page.tsx under app/, mapped to the URL path it serves. */
interface ServedRoute {
  /** URL path, route groups removed, dynamic segments intact. */
  route: string;
  /** Absolute path to the page file. */
  file: string;
  /** page.tsx plus every ancestor layout.tsx, nearest last. */
  chain: string[];
}

/** Segments that never appear in a URL. */
function isRouteGroup(segment: string): boolean {
  return /^\(.+\)$/.test(segment);
}

/** Parallel (@slot) and intercepting ((.)foo) routes do not own a URL path. */
function isNonAddressable(segment: string): boolean {
  return segment.startsWith('@') || /^\(\.+\)/.test(segment);
}

function collectRoutes(dir: string, urlSegments: string[], layouts: string[]): ServedRoute[] {
  const found: ServedRoute[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }

  // A layout at this level wraps everything below it.
  const nextLayouts = entries.includes('layout.tsx')
    ? [...layouts, join(dir, 'layout.tsx')]
    : layouts;

  if (entries.includes('page.tsx')) {
    const file = join(dir, 'page.tsx');
    found.push({
      route: '/' + urlSegments.join('/'),
      file,
      chain: [...nextLayouts, file],
    });
  }

  for (const entry of entries) {
    if (entry === '_archive' || entry === 'node_modules' || entry.startsWith('.')) continue;
    const child = join(dir, entry);
    if (!statSync(child).isDirectory()) continue;
    if (isNonAddressable(entry)) continue;
    const segments = isRouteGroup(entry) ? urlSegments : [...urlSegments, entry];
    found.push(...collectRoutes(child, segments, nextLayouts));
  }

  return found;
}

/**
 * Substitute a concrete value for dynamic segments so the guard patterns —
 * written against real URLs — can be tested against a route template.
 */
function concreteUrl(route: string): string {
  const url = route
    .replace(/\[\[?\.\.\.([^\]]+)\]\]?/g, 'x')
    .replace(/\[([^\]]+)\]/g, 'x');
  return url === '' ? '/' : url;
}

/** Does this page, or any layout wrapping it, perform its own auth check? */
const SELF_GUARD = /\bauth\s*\(\s*\)|\bcurrentUser\s*\(|\brequireRole\b|\brequireOrgRole\b/;

function isSelfGuarded(chain: string[]): boolean {
  return chain.some((f) => {
    let source: string;
    try {
      source = readFileSync(f, 'utf8');
    } catch {
      return false;
    }
    // Strip comments so prose describing auth does not read as auth.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return SELF_GUARD.test(code);
  });
}

// ── Analyse ────────────────────────────────────────────────────────────────

const served = collectRoutes(APP_DIR, [], []).sort((a, b) => a.route.localeCompare(b.route));

const unclassified: string[] = [];
const selfGuarded: string[] = [];

for (const r of served) {
  const url = concreteUrl(r.route);
  if (PUBLIC_ROUTE_PATTERNS.some((p) => p.test(url))) continue;
  if (PROTECTED_ROUTES.some((p) => p.pattern.test(url))) continue;
  if (isSelfGuarded(r.chain)) {
    selfGuarded.push(r.route);
    continue;
  }
  unclassified.push(r.route);
}

const servedUrls = served.map((r) => concreteUrl(r.route));
const orphanGuards = PROTECTED_ROUTES
  .filter((p) => !servedUrls.some((u) => p.pattern.test(u)))
  .map((p) => `${String(p.pattern)} -> ${p.role}`);

// A role's post-login landing page must be a route that exists. When it does
// not, every user of that role lands on a 404 the moment they sign in.
const deadLandings = Object.entries(ROLE_LANDING)
  .filter(([, target]) => !servedUrls.includes(target))
  .map(([role, target]) => `${role} -> ${target}`);

// ── Report ─────────────────────────────────────────────────────────────────

interface Rule {
  id: string;
  mode: Mode;
  title: string;
  findings: string[];
}

const rules: Rule[] = [
  {
    id: 'ROUTE-01',
    mode: 'ratchet',
    title: 'served route protected by nothing and declared public by nothing',
    findings: unclassified,
  },
  {
    id: 'ROUTE-02',
    mode: 'ratchet',
    title: 'guard pattern matching no served route (orphaned guard)',
    findings: orphanGuards,
  },
  {
    id: 'ROUTE-03',
    mode: 'ratchet',
    title: 'ROLE_LANDING target that is not a served route',
    findings: deadLandings,
  },
];

/**
 * Baselines are LISTS, not counts. A count tells you a gate went red; a list
 * tells you which route did it. It also makes the baseline file a reviewable
 * inventory of known drift — an entry appearing or disappearing is a visible
 * line in the PR diff, which a number can never be.
 */
const baseline: Record<string, string[]> = UPDATE
  ? {}
  : JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

if (UPDATE) {
  const next = Object.fromEntries(
    rules.filter((r) => r.mode === 'ratchet').map((r) => [r.id, r.findings]),
  );
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log('route-guard baselines rewritten:');
  for (const r of rules) console.log(`  ${r.id}: ${r.findings.length}`);
  process.exit(0);
}

let failed = false;
const verbose = process.argv.includes('--verbose');

console.log(
  `check-route-guards — ${served.length} served routes, ` +
    `${PROTECTED_ROUTES.length} guard patterns, ${selfGuarded.length} self-guarded\n`,
);

for (const rule of rules) {
  const known = rule.mode === 'error' ? [] : (baseline[rule.id] ?? []);
  const knownSet = new Set(known);
  const found = rule.findings;
  const foundSet = new Set(found);

  const added = found.filter((f) => !knownSet.has(f));
  const fixed = known.filter((f) => !foundSet.has(f));

  if (added.length > 0) {
    failed = true;
    console.error(`✗ ${rule.id} ${rule.title}`);
    for (const f of added) console.error(`      + ${f}`);
    if (rule.mode === 'ratchet') {
      console.error(
        `    ${added.length} new since baseline. Guard the route, declare it public,\n` +
          `    or — if this drift is genuinely accepted — pnpm check:routes --update`,
      );
    }
  } else if (fixed.length > 0) {
    // Not a failure to celebrate silently: an un-updated baseline lets the
    // same drift return later without tripping the gate.
    failed = true;
    console.error(
      `✗ ${rule.id} ${fixed.length} baselined item(s) no longer present — debt was paid.`,
    );
    for (const f of fixed) console.error(`      - ${f}`);
    console.error(`    Lock it in: pnpm check:routes --update`);
  } else {
    console.log(
      `✓ ${rule.id} ${found.length}${rule.mode === 'ratchet' ? ' (all baselined)' : ''}`,
    );
    if (verbose) for (const f of found) console.log(`      · ${f}`);
  }
}

process.exit(failed ? 1 : 0);
