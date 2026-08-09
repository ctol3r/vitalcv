/**
 * Golden Path route contract — Wave 2F regression hardening.
 *
 * Dead links have shipped repeatedly (5× `/opportunities/[id]`, `/get-ready`
 * referenced by 5 surfaces before it existed, `/documents` ×2, and
 * `/holder/blockers/[id]` built in the data layer while the page only lived
 * in `_archive/` — PR #491). This suite makes that class of regression fail
 * CI in four independent ways:
 *
 *  1. Route presence — every Golden Path route must have a live page.
 *     Deleting or archiving `app/holder/settings/page.tsx` fails here even
 *     if every inbound link is removed in the same change.
 *  2. Link contract — every internal href constructed by the golden-path
 *     surfaces (JSX attrs, object keys, variable assignments, template
 *     literals, router.push/replace, redirect()) must resolve to a live
 *     route. Files are auto-discovered under the golden scan roots, so new
 *     surfaces are covered without editing this test.
 *  3. Repo-wide namespace sweep — ANY quoted string anywhere in app/,
 *     components/, or lib/ that mints a URL in a golden namespace
 *     (/holder, /clinician, /get-ready, /verify, /activity, /apply) must
 *     resolve, regardless of syntax. This is the net for data-layer and
 *     constant-table href construction.
 *  4. Negative controls — the extractor and resolver are themselves under
 *     test (fixture source, fixture route tree, live `_archive` probes), so
 *     a regex or resolver regression cannot silently pass everything.
 *
 * Resolver semantics mirror Next.js App Router routing: `(group)` folders
 * are transparent, `_private` folders and `@parallel` slots are never
 * routable (so `_archive/**` copies of retired pages do NOT count as live
 * routes), `[param]` matches one segment, `[...rest]` one-or-more,
 * `[[...rest]]` zero-or-more.
 *
 * Companion inventory: docs/product/golden-path-route-inventory.md
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { UserRole, getRequiredRole, isPublicRoute } from '@/lib/auth/roles';

const WEB_ROOT = resolve(__dirname, '..');
const APP_ROOT = join(WEB_ROOT, 'app');
const PUBLIC_ROOT = join(WEB_ROOT, 'public');

// ---------------------------------------------------------------------------
// Route resolver — mirrors Next.js App Router matching semantics.
// ---------------------------------------------------------------------------

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js'];
const ROUTE_HANDLER_FILES = ['route.ts', 'route.js'];

const isDynamicDir = (name: string) => name.startsWith('[') && name.endsWith(']');
const isCatchAllDir = (name: string) => name.startsWith('[...') || name.startsWith('[[...');
const isRouteGroup = (name: string) => name.startsWith('(') && name.endsWith(')');
/** Next.js never routes into private (`_`) folders or parallel (`@`) slots. */
const isUnroutableDir = (name: string) => name.startsWith('_') || name.startsWith('@');

function childDirs(dir: string): Array<{ name: string; path: string }> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: join(dir, e.name) }));
}

/** A URL "level": the dir itself plus any `(group)` children, transitively. */
function levelDirs(dir: string): string[] {
  const out = [dir];
  for (const child of childDirs(dir)) {
    if (isRouteGroup(child.name)) out.push(...levelDirs(child.path));
  }
  return out;
}

/** Page reachable at this level: own page file, or an optional catch-all child. */
function hasPageAtLevel(dir: string): boolean {
  if (PAGE_FILES.some((f) => existsSync(join(dir, f)))) return true;
  return childDirs(dir).some(
    (child) =>
      child.name.startsWith('[[...') &&
      PAGE_FILES.some((f) => existsSync(join(child.path, f))),
  );
}

const hasRouteHandler = (dir: string) =>
  ROUTE_HANDLER_FILES.some((f) => existsSync(join(dir, f)));

const stripQueryHash = (path: string) => path.replace(/[?#].*$/, '');

/**
 * All app dirs a concrete route path can land in. Catch-all segments absorb
 * the remaining path; route groups are expanded; `_`/`@` dirs are skipped.
 */
function resolveRouteDirs(routePath: string, root = APP_ROOT): string[] {
  const segments = stripQueryHash(routePath).split('/').filter(Boolean);
  let candidates = levelDirs(root);
  const terminal: string[] = [];

  for (const segment of segments) {
    const next: string[] = [];
    for (const level of candidates) {
      for (const child of childDirs(level)) {
        if (isUnroutableDir(child.name) || isRouteGroup(child.name)) continue;
        if (isCatchAllDir(child.name)) {
          terminal.push(...levelDirs(child.path)); // absorbs all remaining segments
        } else if (child.name === segment || isDynamicDir(child.name)) {
          // literal match, or `[param]` matching any single segment
          // (including `[x]` pattern segments — presence checks stay
          // rename-tolerant).
          next.push(...levelDirs(child.path));
        }
      }
    }
    candidates = next;
    if (candidates.length === 0) break;
  }

  return [...candidates, ...terminal];
}

/**
 * Static `{ source, destination }` pairs from next.config.mjs rewrites() and
 * redirects(). A rewritten/redirected source is a live URL with no page.tsx
 * (e.g. `/.well-known/jwks.json` → `/api/.well-known/jwks.json`), so the
 * resolver must honor them — but only when the destination itself resolves.
 */
function parseConfigAliases(configSource: string): Map<string, string> {
  const aliases = new Map<string, string>();
  const pair =
    /\{\s*source:\s*['"]([^'"]+)['"]\s*,\s*destination:\s*['"]([^'"]+)['"]/g;
  for (const match of configSource.matchAll(pair)) {
    // Skip pattern sources (`/old/:id`, regex) — only static aliases are checkable.
    if (!/[:*(]/.test(match[1])) aliases.set(match[1], match[2]);
  }
  return aliases;
}

const NEXT_CONFIG_PATH = join(WEB_ROOT, 'next.config.mjs');
const CONFIG_ALIASES = existsSync(NEXT_CONFIG_PATH)
  ? parseConfigAliases(readFileSync(NEXT_CONFIG_PATH, 'utf-8'))
  : new Map<string, string>();

/** Does a concrete (or `[param]`-patterned) route path serve a page? */
function routeExists(routePath: string, root = APP_ROOT, seenAliases?: Set<string>): boolean {
  const clean = stripQueryHash(routePath);
  // Rewrite/redirect sources are live iff their destination resolves.
  // (Real app tree only — fixture trees have no next.config. The seen-set
  // keeps a malformed config with an alias cycle from hanging the suite.)
  if (root === APP_ROOT && CONFIG_ALIASES.has(clean) && !seenAliases?.has(clean)) {
    const destination = stripQueryHash(CONFIG_ALIASES.get(clean)!);
    const seen = seenAliases ?? new Set<string>();
    seen.add(clean);
    if (destination !== clean && routeExists(destination, root, seen)) return true;
  }
  const dirs = resolveRouteDirs(clean, root);
  const isApi = clean === '/api' || clean.startsWith('/api/');
  return dirs.some((dir) => hasPageAtLevel(dir) || (isApi && hasRouteHandler(dir)));
}

/** A template head like `/holder/blockers/` must own a dynamic child route. */
function dynamicChildRouteExists(head: string, root = APP_ROOT): boolean {
  const clean = stripQueryHash(head);
  const isApi = clean === '/api' || clean.startsWith('/api/');
  return resolveRouteDirs(clean, root).some((dir) =>
    childDirs(dir).some(
      (child) =>
        isDynamicDir(child.name) &&
        levelDirs(child.path).some(
          (d) => hasPageAtLevel(d) || (isApi && hasRouteHandler(d)),
        ),
    ),
  );
}

/** A prefix reference like `/holder/blockers/` (startsWith checks) must own
 *  at least one live route somewhere in its subtree. */
function routePrefixExists(prefix: string, root = APP_ROOT): boolean {
  const subtreeHasPage = (dir: string): boolean => {
    if (hasPageAtLevel(dir)) return true;
    return childDirs(dir).some(
      (child) => !isUnroutableDir(child.name) && subtreeHasPage(child.path),
    );
  };
  return resolveRouteDirs(stripQueryHash(prefix), root).some(subtreeHasPage);
}

/** hrefs like /logo.svg are served from public/, not the app router. */
function publicAssetExists(path: string): boolean {
  return /\.[a-z0-9]+$/i.test(path) && existsSync(join(PUBLIC_ROOT, stripQueryHash(path)));
}

// ---------------------------------------------------------------------------
// Href extraction
// ---------------------------------------------------------------------------

type RefKind = 'exact' | 'dynamic-head' | 'prefix';
interface RouteRef {
  path: string;
  kind: RefKind;
  via: string;
}

/** Namespaces owned by the clinician Golden Path. Segment-aware: `/verify`
 *  must not match `/verifier`. */
const GOLDEN_NAMESPACES = ['/holder', '/clinician', '/get-ready', '/verify', '/activity', '/apply'];

function inGoldenNamespace(path: string): boolean {
  const clean = stripQueryHash(path);
  return GOLDEN_NAMESPACES.some((ns) => clean === ns || clean.startsWith(`${ns}/`));
}

/** Classify a fully-static extracted string. Trailing slash ⇒ prefix reference. */
function staticRef(path: string, via: string): RouteRef | null {
  const clean = stripQueryHash(path);
  if (!clean.startsWith('/') || clean.startsWith('//')) return null;
  if (clean !== '/' && clean.endsWith('/')) {
    return { path: clean.replace(/\/+$/, ''), kind: 'prefix', via };
  }
  return { path: clean, kind: 'exact', via };
}

/** Parse a template-literal body; `${` makes everything after the last `/` dynamic. */
function templateRef(body: string, via: string): RouteRef | null {
  const exprAt = body.indexOf('${');
  if (exprAt === -1) return staticRef(body, via);
  const head = body.slice(0, exprAt);
  if (!head.startsWith('/') || head.startsWith('//')) return null;
  // Dynamic expression entirely inside the query/hash (`/x?apply=${id}`) —
  // the route part is static.
  const queryAt = head.search(/[?#]/);
  if (queryAt !== -1) return staticRef(head.slice(0, queryAt), via);
  const headDir = head.slice(0, head.lastIndexOf('/') + 1).replace(/\/+$/, '');
  // `/${x}` — fully dynamic from the root; nothing statically checkable.
  if (!headDir || headDir === '/') return null;
  return { path: headDir, kind: 'dynamic-head', via };
}

interface Extractor {
  via: string;
  re: RegExp;
  template?: boolean;
}

/**
 * Full extraction — CTA surfaces. Every way this codebase has ever built an
 * internal link: JSX attrs, braced literals, object keys (`href:`), variable
 * assignments (`const applyHref = …`), and navigation calls
 * (router.push/replace, redirect, permanentRedirect, prefetch).
 */
const FULL_EXTRACTORS: Extractor[] = [
  { via: 'jsx-attr', re: /\bhref=["'](\/[^"']*)["']/g },
  { via: 'jsx-brace', re: /\bhref=\{\s*["'](\/[^"']*)["']\s*\}/g },
  { via: 'jsx-template', re: /\bhref=\{\s*`([^`]*)`/g, template: true },
  { via: 'object-key', re: /\bhref:\s*["'](\/[^"']*)["']/g },
  { via: 'object-key-template', re: /\bhref:\s*`([^`]*)`/g, template: true },
  { via: 'assignment', re: /\b\w*[hH]ref\s*=\s*["'](\/[^"']*)["']/g },
  { via: 'assignment-template', re: /\b\w*[hH]ref\s*=\s*`([^`]*)`/g, template: true },
  { via: 'nav-call', re: /\b(?:push|replace|redirect|permanentRedirect|prefetch)\(\s*["'](\/[^"']*)["']/g },
  { via: 'nav-call-template', re: /\b(?:push|replace|redirect|permanentRedirect|prefetch)\(\s*`([^`]*)`/g, template: true },
];

/**
 * Namespace catch-all — every quoted string that mints a golden-namespace
 * URL, regardless of syntax. Catches route-constant tables, data-layer
 * builders, ternary arms, string-concatenation heads, prefix classifiers.
 */
const NAMESPACE_QUOTED = new RegExp(
  `["'](/(?:${GOLDEN_NAMESPACES.map((n) => n.slice(1)).join('|')})(?:[/?#][^"']*)?)["']`,
  'g',
);
const ANY_TEMPLATE = /`([^`]*)`/g;

function extractRefs(source: string, mode: 'full' | 'namespace'): RouteRef[] {
  const refs = new Map<string, RouteRef>();
  const add = (ref: RouteRef | null) => {
    if (ref) refs.set(`${ref.kind}:${ref.path}`, ref);
  };

  if (mode === 'full') {
    for (const { via, re, template } of FULL_EXTRACTORS) {
      for (const match of source.matchAll(re)) {
        add(template ? templateRef(match[1], via) : staticRef(match[1], via));
      }
    }
  }

  // Namespace catch-all always runs.
  for (const match of source.matchAll(NAMESPACE_QUOTED)) {
    add(staticRef(match[1], 'namespace-string'));
  }
  for (const match of source.matchAll(ANY_TEMPLATE)) {
    const ref = templateRef(match[1], 'namespace-template');
    if (ref && inGoldenNamespace(ref.path)) add(ref);
  }

  return [...refs.values()];
}

/** Which refs do not resolve to a live route (or public asset)? */
function deadRefs(refs: RouteRef[], root = APP_ROOT): RouteRef[] {
  return refs.filter((ref) => {
    if (ref.kind === 'dynamic-head') return !dynamicChildRouteExists(ref.path, root);
    if (ref.kind === 'prefix') return !routePrefixExists(ref.path, root);
    return !(routeExists(ref.path, root) || publicAssetExists(ref.path));
  });
}

const describeRef = (ref: RouteRef) =>
  `${ref.path}${ref.kind === 'dynamic-head' ? '/${…}' : ref.kind === 'prefix' ? '/*' : ''} (${ref.via})`;

// ---------------------------------------------------------------------------
// Scan sets
// ---------------------------------------------------------------------------

/** Golden Path surface roots — every .ts/.tsx below gets FULL extraction. */
const GOLDEN_SCAN_ROOTS = [
  'app/holder',
  'app/clinician',
  'app/get-ready',
  'app/verify',
  'app/activity',
  'app/apply',
  'components/mobile',
  'components/clinician',
  'components/recognition',
  // Global chrome + gate surfaces. WorkspaceSwitcher shipped a /workspace/switch
  // href (a route that never existed outside _archive) for weeks because these
  // roots were not scanned — the persona widget renders on every signed-in
  // page, so its links are as load-bearing as any Golden Path CTA.
  'components/workspace',
  'components/layout',
  'components/explore',
  'components/employer',
  'lib/mobile',
];

/** Entry CTA surfaces outside the roots that feed the Golden Path. */
// The homepage composition, whatever currently serves `/`. Both are listed on
// purpose: the film is what `/` renders (#859), and HomePageClient remains on
// disk as the documented rollback target — an unresolvable href in either one
// is a broken link waiting to happen.
// `app/HomePageClient.tsx` was deleted by the homepage recovery (#1060); the
// homepage's links now all live in the film component below.
const EXTRA_FULL_SCAN_FILES = ['components/home/film/HorizontalCareerFilm.tsx'];

/**
 * Coverage floor: these load-bearing surfaces must exist AND be inside the
 * scan set. A rename that silently drops one out of coverage fails here.
 */
const CORE_SURFACE_FILES = [
  'app/holder/page.tsx',
  'app/holder/readiness/ReadinessSurface.tsx',
  'app/holder/timeline/page.tsx',
  'app/get-ready/GetReadySurface.tsx',
  'app/clinician/profile/ProfileSurface.tsx',
  'app/holder/opportunities/[id]/OpportunityDetailSurface.tsx',
  'app/holder/settings/SettingsSurface.tsx',
  'components/mobile/ClinicianHomeSurface.tsx',
  'components/mobile/ClinicianOpportunitiesSurface.tsx',
  'components/mobile/ClinicianApplicationsSurface.tsx',
  'components/mobile/ClinicianApplicationDetailSurface.tsx',
  'components/mobile/ClinicianPanels.tsx',
  'components/mobile/ClinicianBlockerDetailSurface.tsx',
  'components/clinician/MobileBottomNav.tsx',
  'components/recognition/RecognitionCard.tsx',
  'components/recognition/RecognitionSurface.tsx',
  'components/recognition/ShareRecognitionPanel.tsx',
  'lib/mobile/clinician-state.ts',
];

const SOURCE_FILE = /\.(ts|tsx)$/;
const EXCLUDED_FILE = /(\.test\.|\.spec\.|\.d\.ts$)/;

function walkSourceFiles(relRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name.startsWith('_') || // _archive and friends — never production code paths
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === '__tests__' ||
          entry.name === '__snapshots__'
        ) {
          continue;
        }
        walk(abs);
      } else if (SOURCE_FILE.test(entry.name) && !EXCLUDED_FILE.test(entry.name)) {
        out.push(relative(WEB_ROOT, abs).split(sep).join('/'));
      }
    }
  };
  const absRoot = join(WEB_ROOT, relRoot);
  if (existsSync(absRoot)) walk(absRoot);
  return out;
}

const fullScanFiles = [
  ...new Set([...GOLDEN_SCAN_ROOTS.flatMap(walkSourceFiles), ...EXTRA_FULL_SCAN_FILES]),
].sort();

// ---------------------------------------------------------------------------
// 1. Route presence — the Golden Path inventory
//    (docs/product/golden-path-route-inventory.md mirrors this table)
// ---------------------------------------------------------------------------

type AuthExpectation = 'public' | 'clinician' | 'passthrough';

const GOLDEN_PATH_ROUTES: Array<{ route: string; auth: AuthExpectation }> = [
  { route: '/get-ready', auth: 'public' },
  { route: '/onboarding', auth: 'public' },
  { route: '/holder', auth: 'clinician' },
  { route: '/holder/home', auth: 'clinician' },
  { route: '/holder/readiness', auth: 'clinician' },
  { route: '/holder/blockers/[blockerId]', auth: 'clinician' },
  { route: '/holder/opportunities', auth: 'clinician' },
  { route: '/holder/opportunities/discover', auth: 'clinician' },
  { route: '/holder/opportunities/interested', auth: 'clinician' },
  { route: '/holder/opportunities/passed', auth: 'clinician' },
  { route: '/holder/opportunities/[id]', auth: 'clinician' },
  { route: '/holder/applications', auth: 'clinician' },
  { route: '/holder/applications/[id]', auth: 'clinician' },
  { route: '/holder/timeline', auth: 'clinician' },
  { route: '/holder/settings', auth: 'clinician' },
  { route: '/holder/recognition', auth: 'clinician' },
  // Was 'passthrough' — the route rendered owner-scoped data while matching
  // neither guard list. Now CLINICIAN, like every other surface reachable from
  // the holder nav that links to it.
  { route: '/clinician/profile', auth: 'clinician' },
  { route: '/verify/[npi]', auth: 'public' },
  // Supporting routes the Golden Path depends on:
  { route: '/activity/[entityId]', auth: 'passthrough' }, // /holder/timeline redirect target
  { route: '/apply/[bundleId]', auth: 'public' }, // apply flow target
];

describe('golden path route presence — removing any of these pages fails CI', () => {
  for (const { route, auth } of GOLDEN_PATH_ROUTES) {
    it(`${route} has a live page (${auth})`, () => {
      expect(
        routeExists(route),
        `${route} no longer resolves to a page under apps/web/app — ` +
          'a Golden Path route was removed, renamed, or archived. If intentional, ' +
          'update GOLDEN_PATH_ROUTES and docs/product/golden-path-route-inventory.md.',
      ).toBe(true);

      // Middleware auth classification must match the inventory.
      const concrete = route.replace(/\[[^\]]+\]/g, 'x123');
      if (auth === 'public') {
        expect(isPublicRoute(concrete), `${route} should be public per inventory`).toBe(true);
      } else if (auth === 'clinician') {
        expect(getRequiredRole(concrete), `${route} should require CLINICIAN role`).toBe(
          UserRole.CLINICIAN,
        );
      } else {
        expect(isPublicRoute(concrete), `${route} should be middleware pass-through`).toBe(false);
        expect(getRequiredRole(concrete), `${route} should be middleware pass-through`).toBeNull();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Link contract — full extraction over auto-discovered surfaces
// ---------------------------------------------------------------------------

describe('golden path link contract — every constructed href resolves', () => {
  it('coverage floor: core surfaces exist and are inside the scan set', () => {
    const missing = CORE_SURFACE_FILES.filter((rel) => !existsSync(join(WEB_ROOT, rel)));
    expect(missing, `core golden-path surfaces missing from disk: ${missing.join(', ')}`).toEqual([]);
    const uncovered = CORE_SURFACE_FILES.filter((rel) => !fullScanFiles.includes(rel));
    expect(uncovered, `core surfaces dropped out of scan coverage: ${uncovered.join(', ')}`).toEqual([]);
  });

  for (const rel of fullScanFiles) {
    it(`${rel}: every internal href resolves to a live route`, () => {
      const source = readFileSync(join(WEB_ROOT, rel), 'utf-8');
      const dead = deadRefs(extractRefs(source, 'full'));
      expect(
        dead.map(describeRef),
        `dead links in ${rel}: ${dead.map(describeRef).join(', ')}`,
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Repo-wide golden-namespace sweep — no file may mint a dead golden URL
// ---------------------------------------------------------------------------

describe('repo-wide golden-namespace sweep', () => {
  it('no quoted golden-namespace URL anywhere in app/, components/, lib/ is dead', () => {
    const sweepFiles = ['app', 'components', 'lib']
      .flatMap(walkSourceFiles)
      .filter((rel) => !fullScanFiles.includes(rel));

    const offenders: Record<string, string[]> = {};
    for (const rel of sweepFiles) {
      const source = readFileSync(join(WEB_ROOT, rel), 'utf-8');
      const dead = deadRefs(extractRefs(source, 'namespace'));
      if (dead.length > 0) offenders[rel] = dead.map(describeRef);
    }

    expect(
      offenders,
      `files minting dead golden-namespace URLs:\n${JSON.stringify(offenders, null, 2)}`,
    ).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 4. Negative controls — the contract itself is under test
// ---------------------------------------------------------------------------

describe('negative controls — extractor', () => {
  // Every syntactic form this codebase uses to build hrefs, plus one
  // guaranteed-dead route. If the extractor regresses, these fail first.
  const FIXTURE = `
    <Link href="/holder/home">a</Link>
    <a href='/get-ready'>b</a>
    <Link href={'/holder/readiness'} />
    const a = <Link href={\`/holder/opportunities/\${id}\`} />;
    const nav = [{ name: 'Apps', href: '/holder/applications' }];
    const item = { href: \`/holder/blockers/\${encodeURIComponent(id)}\` };
    const applyHref = \`/holder/opportunities/\${role.id}?apply=1\`;
    const settingsHref = '/holder/settings';
    router.push('/holder/timeline');
    router.replace(\`/verify/\${npi}\`);
    redirect('/get-ready');
    const head = '/activity/' + entityId;
    const isBlocker = pathname.startsWith('/holder/blockers/');
    const arm = ok ? '/holder/recognition' : '/get-ready';
    const shareApply = \`/holder/opportunities?apply=\${selected.id}\`;
    const rootDynamic = \`/\${locale}/anything\`;
    const DEAD = '/holder/__contract_negative_control__';
  `;

  const refs = extractRefs(FIXTURE, 'full');
  const byKey = new Set(refs.map((r) => `${r.kind}:${r.path}`));

  const expected: Array<[RefKind, string]> = [
    ['exact', '/holder/home'],
    ['exact', '/get-ready'],
    ['exact', '/holder/readiness'],
    ['dynamic-head', '/holder/opportunities'],
    ['exact', '/holder/applications'],
    ['dynamic-head', '/holder/blockers'],
    ['exact', '/holder/settings'],
    ['exact', '/holder/timeline'],
    ['dynamic-head', '/verify'],
    ['prefix', '/activity'],
    ['prefix', '/holder/blockers'],
    ['exact', '/holder/recognition'],
    // dynamic expression confined to the query string ⇒ static route part
    ['exact', '/holder/opportunities'],
    ['exact', '/holder/__contract_negative_control__'],
  ];

  for (const [kind, path] of expected) {
    it(`extracts ${kind} ${path}`, () => {
      expect(byKey.has(`${kind}:${path}`), `extractor lost ${kind}:${path}`).toBe(true);
    });
  }

  it('flags the planted dead route and passes the live ones', () => {
    const dead = deadRefs(refs).map((r) => r.path);
    expect(dead).toEqual(['/holder/__contract_negative_control__']);
  });

  it('fully-dynamic root templates are not statically checkable and stay out', () => {
    expect(refs.some((r) => r.path === '/')).toBe(false);
  });

  it('extraction floor: real surfaces still yield their load-bearing refs', () => {
    const probes: Array<{ file: string; kind: RefKind; path: string }> = [
      // object-key hrefs in the bottom nav
      { file: 'components/clinician/MobileBottomNav.tsx', kind: 'exact', path: '/holder/home' },
      // data-layer template assignment (the PR #491 escape route)
      { file: 'lib/mobile/clinician-state.ts', kind: 'dynamic-head', path: '/holder/blockers' },
      // server-side redirect() calls, static + template head
      { file: 'app/holder/timeline/page.tsx', kind: 'exact', path: '/onboarding' },
      { file: 'app/holder/timeline/page.tsx', kind: 'dynamic-head', path: '/activity' },
    ];
    const missing = probes.filter(({ file, kind, path }) => {
      const source = readFileSync(join(WEB_ROOT, file), 'utf-8');
      return !extractRefs(source, 'full').some((r) => r.kind === kind && r.path === path);
    });
    expect(
      missing.map((p) => `${p.file} → ${p.kind}:${p.path}`),
      'extractor no longer sees refs that exist in production surfaces',
    ).toEqual([]);
  });
});

describe('negative controls — resolver (fixture route tree)', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'golden-path-route-fixture-'));
  const APP = join(fixtureRoot, 'app');
  const page = (rel: string) => {
    mkdirSync(join(APP, rel), { recursive: true });
    writeFileSync(join(APP, rel, 'page.tsx'), 'export default function P() { return null; }\n');
  };

  page('.'); // /
  page('(marketing)/grouped'); // /grouped — route groups are transparent
  page('_archive/hidden'); // NOT routable — private folder
  page('_archive/wave/holder/stuff'); // NOT routable — archived golden-path shape
  page('@modal/slotted'); // NOT routable — parallel slot
  page('real/[id]'); // /real/[id]
  page('deep/nested/leaf'); // /deep/nested/leaf
  page('auth/[[...rest]]'); // /auth (optional catch-all, zero segments)
  page('files/[...parts]'); // /files/a/b (required catch-all)
  mkdirSync(join(APP, 'empty'), { recursive: true }); // dir without page

  afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  const cases: Array<[string, boolean, string]> = [
    ['/', true, 'root page'],
    ['/grouped', true, 'route groups are transparent'],
    ['/hidden', false, 'private folders are not implicit route segments'],
    ['/_archive/hidden', false, 'archived pages are NOT valid production routes'],
    ['/_archive/wave/holder/stuff', false, 'archived golden-path copies do not count'],
    ['/holder/stuff', false, 'archive contents do not leak into the live namespace'],
    ['/slotted', false, 'parallel slots are not routes'],
    ['/@modal/slotted', false, 'parallel slots are not routes even addressed directly'],
    ['/real/123', true, 'dynamic segment matches a concrete value'],
    ['/real/[id]', true, 'presence checks accept [param] patterns'],
    ['/real', false, 'dynamic parent without page does not resolve'],
    ['/deep', false, 'intermediate dir without page is not a route'],
    ['/deep/nested/leaf', true, 'deep literal route resolves'],
    ['/auth', true, 'optional catch-all serves the zero-segment path'],
    ['/auth/a/b', true, 'optional catch-all absorbs remaining segments'],
    ['/files/a/b/c', true, 'required catch-all absorbs remaining segments'],
    ['/empty', false, 'dir without page file is not a route'],
  ];

  for (const [path, expectedResult, why] of cases) {
    it(`routeExists('${path}') === ${expectedResult} — ${why}`, () => {
      expect(routeExists(path, APP)).toBe(expectedResult);
    });
  }

  it('dynamic-head and prefix semantics', () => {
    expect(dynamicChildRouteExists('/real', APP)).toBe(true);
    expect(dynamicChildRouteExists('/deep', APP)).toBe(false);
    expect(routePrefixExists('/deep', APP)).toBe(true); // subtree owns /deep/nested/leaf
    expect(routePrefixExists('/empty', APP)).toBe(false);
    expect(routePrefixExists('/_archive', APP)).toBe(false);
  });
});

describe('negative controls — config aliases (rewrites/redirects)', () => {
  it('parser extracts static pairs and skips pattern sources', () => {
    const fixture = `
      { source: '/.well-known/jwks.json', destination: '/api/.well-known/jwks.json' },
      { source: '/old/:id', destination: '/new/:id' },
      { source: '/dashboard', destination: '/intelligence?view=dashboard' },
    `;
    const aliases = parseConfigAliases(fixture);
    expect(aliases.get('/.well-known/jwks.json')).toBe('/api/.well-known/jwks.json');
    expect(aliases.get('/dashboard')).toBe('/intelligence?view=dashboard');
    expect(aliases.has('/old/:id')).toBe(false);
  });

  it('known rewrite sources resolve through their live destinations', () => {
    // Guard: if next.config.mjs rewrites move or the parser regresses,
    // these public verifier endpoints would read as dead again.
    expect(CONFIG_ALIASES.size).toBeGreaterThan(0);
    expect(routeExists('/.well-known/jwks.json')).toBe(true);
    expect(routeExists('/.well-known/trust.json')).toBe(true);
  });
});

describe('negative controls — live tree', () => {
  it('a synthetic route never resolves', () => {
    expect(routeExists('/holder/__contract_negative_control__')).toBe(false);
    expect(dynamicChildRouteExists('/holder/__contract_negative_control__')).toBe(false);
    expect(routePrefixExists('/holder/__contract_negative_control__')).toBe(false);
  });

  // The sharpest control available: real page.tsx files exist under
  // app/_archive/** in golden-path shapes. They must never count as live.
  const archiveRoot = join(APP_ROOT, '_archive');
  const archivedPages = existsSync(archiveRoot) ? walkArchivedPages(archiveRoot) : [];

  it.skipIf(archivedPages.length === 0)(
    'archived page.tsx files are not valid production routes',
    () => {
      for (const rel of archivedPages.slice(0, 5)) {
        const archivedRoute = `/_archive/${rel.replace(/\/?page\.tsx?$/, '')}`;
        expect(
          routeExists(archivedRoute),
          `${archivedRoute} has a real page.tsx on disk but must not be routable`,
        ).toBe(false);
      }
    },
  );
});

function walkArchivedPages(archiveRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/^page\.tsx?$/.test(entry.name)) {
        out.push(relative(archiveRoot, abs).split(sep).join('/'));
      }
    }
  };
  walk(archiveRoot);
  return out;
}
