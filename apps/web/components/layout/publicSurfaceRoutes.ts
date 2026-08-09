// Public surface paths: routes that show the Navbar + Footer (no auth required).
// Rules:
//   - Do NOT add ops/intelligence routes here (/mission-ops, /intelligence, /graph, etc.)
//   - Do NOT add auth-gated routes here (/holder, /verifier, etc.)
//   - Every entry must resolve to a page module under apps/web/app, OR carry a
//     `pending:` comment naming the PR/wave that lands it. See below.
// See docs/VCV_UI_DOCTRINE.md §2 for classification rules.
//
// PENDING ENTRIES — this file used to describe "listing a not-yet-existing
// path" as an established pattern with no expiry attached. That licence is
// what let nine dead paths accumulate: /developers, /documents, /mobile,
// /ask, /investors, /partners, /updates, /compliance and /clip, every one
// measured 404 against https://vitalcv.com on 2026-08-08, and all but
// /mobile still sitting retired under app/_archive/wave119. Registering a
// path before its page lands is still legitimate — the chrome covers the
// route the moment it ships — but it is now a claim with a name on it:
//
//   // pending: <what lands it> (PR #1234)   ← or (wave W1079)
//   '/some-route',
//
// public-surface-registry.test.ts fails on any entry that has neither a page
// module nor that marker, so an unlanded promise expires loudly instead of
// silently becoming debris.
export const PUBLIC_SURFACE_PATHS = new Set([
  '/',
  '/explore',
  '/get-ready',
  '/onboarding',
  '/pilot',
  '/status',
  '/privacy',
  '/terms',
  '/contact',
  // NOTE — '/employers', '/trust' and '/search' were listed here AND in
  // PREFIX_MATCHERS. The prefix form is a strict superset (it matches the
  // bare path and its children), so the exact entries were dead weight: two
  // places to edit, one of them not the real chrome decision. Dropped
  // 2026-08-08; the prefix entries below are unchanged and still cover them.
  // 2026-08-07 headerless-routes sweep (gap-analysis §8.4). /pricing was
  // indexable sitemap marketing (priority 0.6) rendering with no nav and no
  // footer; /concierge is a sellable offer page nothing linked to. Both are
  // light-ground content pages the standard chrome fits.
  '/pricing',
  '/concierge',
  // A Navbar Trust-group destination. It was de-ops'd (see the note on
  // OPS_SURFACE_PREFIXES) but never listed here, so clicking it from the
  // header dropped the visitor into a chrome-less page. Fixed by the
  // 2026-08-06 shared-header wave.
  '/evidence-network',
  // NOTE — /profile/activate (the clinician activation surface named for PR
  // #1081) was listed here as an exact entry AND covered by the /profile
  // prefix below. The prefix is a strict superset, so the exact entry changed
  // nothing; it is dropped to keep one chrome decision per route. The page is
  // still unlanded and still chromed the moment it ships — see the /profile
  // note in PREFIX_MATCHERS, which is now the single place that fact lives.
  // The Z1 homepage story preview. It must be judged WITH the real global
  // Navbar — the nav shell is part of the composition — so this one route is
  // exempt from the /design self-chrome rule below, mirroring how
  // /dev/compete-film is scoped against the /dev blanket. The /design layout
  // gate still 404s it in canonical production.
  '/design/z1-home',
  '/design/reset',
]);

export function isPublicSafe(route: string): boolean {
  const unsafePrefixes = [
    '/intelligence', '/graph', '/findings', '/providers',
    '/storylines', '/investigations', '/actions', '/network',
    '/calibration', '/system-health', '/status', '/labs',
    '/interview'
  ];
  return !unsafePrefixes.some(p => route === p || route.startsWith(`${p}/`));
}

// Ops-only paths: these get the AppShell (ops chrome), not Navbar+Footer.
// Keep in sync with VCV_UI_DOCTRINE.md §1 Surface Classification.
export const OPS_SURFACE_PREFIXES = [
  '/intelligence',
  '/graph',
  '/findings',
  '/storylines',
  '/actions',
  '/providers',
  '/investigations',
  '/calibration',
  '/system-health',
  '/network',
  '/mission-ops',
  '/operations-engine',
  '/ops/engine',
  // Design-reference surfaces carry their own chrome (wave1505 port et al.)
  '/design',
  // NOTE — /status/technical is deliberately in NEITHER list (bucket E
  // decision, 2026-08-07): the paper journey header would violate the scene
  // system on a dark mono console, and ops classification would mount
  // VCommandBar — ungated intelligence tooling — on a publicly reachable
  // route. It renders as a bare standalone console on purpose;
  // public-surface-registry.test.ts pins all three facts.
  // COMPETE-2 film spike: a full-viewport composition cannot be evaluated with
  // a promo rail over its first scene. Scoped to this ONE harness rather than
  // all of /dev, so the other dev routes keep the chrome their tests expect.
  '/dev/compete-film',
  // NOTE: /evidence-network is no longer self-chromed — the public route is a
  // static transparency page (SHD-0.3 quarantine) rendered with standard site
  // chrome; the explorable graph lives on signed-in surfaces only.
] as const;

/**
 * Routes exempt from an OPS_SURFACE_PREFIXES match. The Z1 homepage story
 * must be reviewed with the real public chrome — the nav shell is part of the
 * composition — while every other /design reference keeps its self-chrome.
 * Scope the exception to ONE route, never widen the rule (the
 * /dev/compete-film pattern).
 */
export const OPS_SURFACE_EXEMPTIONS = new Set<string>(['/design/z1-home', '/design/reset']);

/** The single chrome decision: ops shell, or public Navbar+Footer. */
export function isOpsSurfacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (OPS_SURFACE_EXEMPTIONS.has(pathname)) return false;
  return OPS_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Prefix matchers: chrome the prefix itself and everything under it. A prefix
// earns its place by having at least one routable page in its subtree — that
// is what the registry test asserts. Note this is deliberately weaker than the
// exact-path rule above: a bare `/career-map` 404s because the namespace is
// parameterized (/career-map/[entityId]) with no index page, and that is
// correct, not drift.
//
// Removed 2026-08-08 (Wave 1080 registry hygiene): '/compliance' and '/clip'
// matched no directory under app/ at all — both retired to
// app/_archive/wave119 — and a duplicate '/review' was listed twice.
export const PREFIX_MATCHERS = [
  '/demo',
  '/sign-in',
  '/sign-up',
  '/review',
  '/employers',
  '/opportunities',
  '/docs',
  '/p',
  '/verify',
  '/trust',
  '/legal',
  '/matcha',
  '/for',
  '/solutions',
  // 2026-08-07 headerless-routes sweep. Parameterized public-record surfaces:
  // /directory/[npi] is the indexable NPPES registry page (JSON-LD + canonical
  // — a search visitor landed with no way into the site), /profile/[npi] is
  // the career profile a clinician deliberately shares, /investigate/[npi] is
  // the public diligence surface the survivability registry declares public.
  //
  // pending: /profile also carries /profile/activate, the clinician
  // activation surface that lands with (PR #1081). The page does not exist
  // yet — this prefix is the one place that promise is recorded, and it is
  // load-bearing for ReadinessCard's activation CTA.
  '/directory',
  '/profile',
  '/investigate',
  // Bucket E decision (headerless-routes disposition, 2026-08-07): the
  // WorkspaceNav entity surfaces NEST under the site header rather than
  // substituting for it — one navigation model; the header is the global
  // chrome, the pill-nav is local secondary navigation. A visitor entering
  // from the chromed /demo no longer crosses a chrome cliff mid-journey.
  '/career-intelligence',
  '/career-map',
  '/ecosystem',
  '/packet',
  '/professional-growth',
  '/recruiter',
  '/search',
] as const;

// ── Product surfaces (UX-03) ───────────────────────────────────────────────
//
// The third chrome branch. Before UX-03 this file answered exactly two
// questions — is it public, is it ops — and every signed-in product route fell
// through both to nothing. The 2026-08-09 authed-navigation audit measured the
// result: 39 routes with no header, no <nav> landmark, and in 30 cases zero
// in-app links, the entire employer console and the entire issuer tree among
// them. That was never a per-page oversight; it was a missing branch here.
//
// Membership grants CHROME ONLY. It never widens isPublicSurfacePath, and it
// changes no auth: middleware.ts remains the sole gate, and every prefix below
// is gated there today. A route can sit in this list and still 307 to /sign-in.
//
// /holder is deliberately ABSENT: HolderWorkspaceFrame is its chrome, and it
// mounts the trail itself. Listing it here would render a second header.
export const PRODUCT_SURFACE_PREFIXES = [
  '/employer/applications',
  '/employer/candidates',
  '/employer/dashboard',
  '/employer/decision',
  '/employer/post',
  '/employer/profile',
  '/employer/review',
  '/employer/review-queue',
  '/employer/worklist',
  '/issuer',
  '/admin',
  '/ops',
] as const;

/**
 * The clinician namespace, matched by regex rather than listed as a string
 * above.
 *
 * That namespace is golden with no root page, and the repo-wide sweep in
 * holder-route-contract.test.ts rightly treats any quoted bare form of it —
 * even inside a comment, which is why this note spells none of them — as
 * minting a dead URL. The regex matches only children, which are the routes
 * that actually exist. Same idiom as the activity namespace in
 * isPublicSurfacePath below.
 */
const CLINICIAN_NAMESPACE = /^\/clinician\/.+/;

/**
 * Routes under a product prefix that must NOT take product chrome.
 *
 * /ops/engine is claimed by OPS_SURFACE_PREFIXES (it renders the intelligence
 * AppShell); isProductSurfacePath yields to that, so the two branches stay
 * mutually exclusive and navigation-contract.test.ts can assert it.
 */
export function isProductSurfacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Public and ops classifications win — a route belongs to exactly one class.
  if (isOpsSurfacePath(pathname)) return false;
  if (isPublicSurfacePath(pathname)) return false;
  if (CLINICIAN_NAMESPACE.test(pathname)) return true;
  return PRODUCT_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPublicSurfacePath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  if (PUBLIC_SURFACE_PATHS.has(pathname)) {
    return true;
  }

  // The activity entity surface is chromed like its WorkspaceNav siblings
  // (bucket E, 2026-08-07) but expressed as a regex rather than a
  // PREFIX_MATCHERS string: the activity namespace is golden with no root
  // page, and the repo-wide golden-namespace sweep (holder-route-contract)
  // rightly treats any quoted bare form of it — even in a comment — as
  // minting a dead URL. The regex matches only children that actually exist.
  if (/^\/activity\/.+/.test(pathname)) {
    return true;
  }

  return PREFIX_MATCHERS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isRouteActive(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }

  if (href === '/') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
