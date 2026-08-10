// apps/web/lib/auth/roles.ts
//
// Canonical role definitions, route-role mappings, and post-login redirects.
// Used by middleware, components, and tests.

export const UserRole = {
  CLINICIAN: 'CLINICIAN',
  VERIFIER: 'VERIFIER',
  ISSUER: 'ISSUER',
  ADMIN: 'ADMIN',
  /** Any authenticated user — used for intelligence surfaces */
  AUTHENTICATED: 'AUTHENTICATED',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

/**
 * Default landing page per role after login or role mismatch redirect.
 */
export const ROLE_LANDING: Record<UserRoleType, string> = {
  CLINICIAN: '/holder',
  // Live employer workspace hub. The old `/verifier` tree is archived
  // (app/_archive/verifier) — landing there 404s. See app/employer/*.
  VERIFIER: '/employer/dashboard',
  // The issuer tree has NO index page by design: every issuer surface is keyed
  // by a request id (`/issuer/*/[requestId]`), and routeManifest marks the
  // `/issuer` root an unlinked waypoint precisely because clicking it would
  // 404. So there is no issuer home to land on. The previous target `/issuer`
  // served nothing and 404'd every issuer at sign-in (default post-resolve is
  // `/holder` → wrong-role bounce → here). Fall back to the public front door,
  // reachable by any role without a redirect loop. A real issuer home is a
  // product decision, not a routing bug — tracked separately.
  ISSUER: '/',
  // The live ADMIN operator surface. The previous target `/internal/metrics`
  // exists only under app/_archive and 404'd every admin at sign-in.
  // `/admin/platform` is the ADMIN-gated Founder/Operations dashboard served on
  // main, and `/admin/*` is an ADMIN prefix in PROTECTED_ROUTES so the landing
  // is role-reachable without a mismatch loop.
  ADMIN: '/admin/platform',
  // AUTHENTICATED is a middleware route TIER ("any signed-in user"), not a
  // storable role — the Prisma UserRole enum is {CLINICIAN,VERIFIER,ISSUER,
  // ADMIN}, so `/api/me/role` never returns AUTHENTICATED and this entry is
  // never used as a live landing. It exists only to satisfy the exhaustive
  // Record type and the route-guard gate. The previous target `/intelligence`
  // serves no page. Point it at the public front door, which always resolves.
  AUTHENTICATED: '/',
};

/**
 * Route prefix -> required role mapping.
 * Order matters: more specific prefixes must come first.
 *
 * Surface classification (VCV_UI_DOCTRINE §1):
 *   Public   — /explore, /get-ready, /onboarding, /p/:npi, /verify/:npi, /sign-in, /sign-up, etc.
 *               NOTE: /onboarding is public end-to-end — it resolves the
 *               public registry record anonymously (record before account);
 *               only the BIND (POST /api/profile/npi/bootstrap) needs auth.
 *   Clinician — /holder/*, /clinician/*                    → CLINICIAN role
 *               NOTE: /clinicians (plural) is NOT this tree. The pattern
 *               requires end-of-string or `/` immediately after "clinician",
 *               the same shape that keeps public `/employers` out of the
 *               protected `/employer` workspace.
 *               NOTE: /passport was RETIRED by founder decision 2026-08-07 —
 *               both routes are public redirect stubs (/passport →
 *               /onboarding; /passport/{npi} → /verify/{npi}, kept forever
 *               for shipped mobile deep links).
 *   Verifier  — /verifier/*, /employer/*, /issuer/*       → VERIFIER role
 *               NOTE: /employers (plural) is the PUBLIC acquisition page —
 *               it is deliberately not in PROTECTED_ROUTES. The gated
 *               employer workspace is /employer/* (singular).
 *   Ops/Intel — /intelligence/*, /findings/*, /graph/*, …  → AUTHENTICATED (any)
 *   Internal  — /internal/*, /admin/*, /analytics, /billing,
 *               /pilot-ops, /mission-ops, /command-center → ADMIN role
 *
 * /dashboard/cv-builder is legacy (deprecated per doctrine §8).
 * Route is kept alive and clinician-gated to prevent open access until
 * it is migrated to /holder/* or removed.
 */
export const PROTECTED_ROUTES: Array<{ pattern: RegExp; role: UserRoleType }> = [
  { pattern: /^\/holder(\/.*)?$/, role: UserRole.CLINICIAN },
  // The clinician's own profile tree. `/clinician/profile` server-renders
  // owner-scoped data (loadOwnerRecord → the NPI linked to THIS account, plus
  // that clinician's CMS filing) and was in neither list, so the middleware
  // passed it through unauthenticated. Nothing leaked — the loader itself
  // resolves identity via auth() and degrades — but the route was protected by
  // nothing, and the next page added under /clinician would have inherited
  // that. Guarded as a PREFIX for the same reason /admin is: so the sibling
  // nobody has written yet is born gated.
  { pattern: /^\/clinician(\/.*)?$/, role: UserRole.CLINICIAN },
  { pattern: /^\/verifier(\/.*)?$/, role: UserRole.VERIFIER },
  // W0.3: the LIVE employer workspace. This guard was missing while the
  // `/verifier` guard above protected an archived tree — so every real
  // employer surface (dashboard, worklist, candidates, applications,
  // review-queue, profile, post) answered 200 to anonymous requests in
  // production. The tables happened to be empty, so nothing leaked; the
  // first real pilot record would have been world-readable.
  // `/employers` (plural, public acquisition page) does NOT match: the
  // pattern requires end-of-string or `/` immediately after "employer".
  { pattern: /^\/employer(\/.*)?$/, role: UserRole.VERIFIER },
  { pattern: /^\/issuer(\/.*)?$/, role: UserRole.ISSUER },
  { pattern: /^\/internal(\/.*)?$/, role: UserRole.ADMIN },
  // Internal / operator surfaces — admin only
  // /admin/* — leads, platform, demo-reset. /admin/demo-reset shipped with no
  // guard at all while its siblings self-guarded with inline auth(); this
  // prefix guard covers the whole tree so the next /admin page is born gated.
  { pattern: /^\/admin(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/pilot-ops(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/mission-ops(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/analytics(\/.*)?$/, role: UserRole.ADMIN },
  // Wave 4: /billing was previously unguarded (neither protected nor public).
  // Internal surface per doctrine §1 — admin only.
  { pattern: /^\/billing(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/command-center(\/.*)?$/, role: UserRole.ADMIN },
  // Legacy / deprecated routes — gated to prevent open access
  // /dashboard/cv-builder: deprecated per doctrine §8; migrate to /holder/* eventually
  { pattern: /^\/dashboard(\/.*)?$/, role: UserRole.CLINICIAN },
  { pattern: /^\/workspace(\/.*)?$/, role: UserRole.AUTHENTICATED },
  // Intelligence surfaces — any authenticated user
  { pattern: /^\/intelligence(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/findings(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/storylines(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/providers(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/actions(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/investigations(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/calibration(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/system-health(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/graph(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/network(\/.*)?$/, role: UserRole.AUTHENTICATED },
  { pattern: /^\/documents(\/.*)?$/, role: UserRole.AUTHENTICATED },
];

/**
 * Routes that never require authentication.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/, // landing
  // ── Other public surfaces ─────────────────────────────────────────────────
  /^\/simulation(\/.*)?$/, // public simulation surface
  /^\/mobile(\/.*)?$/, // mobile landing
  /^\/developers(\/.*)?$/, // public developer docs
  /^\/docs(\/.*)?$/, // public docs
  /^\/investors(\/.*)?$/, // public investor page
  /^\/partners(\/.*)?$/, // public partners page
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/get-ready(\/.*)?$/, // legacy entry — redirects to /onboarding
  /^\/onboarding(\/.*)?$/, // canonical clinician activation (anonymous NPI preview)
  /^\/passport(\/.*)?$/, // RETIRED 2026-08-07 — public redirect stubs only (see app/passport)
  /^\/explore(\/.*)?$/, // public opportunities board
  // Public employer acquisition tree — /employers (plural) and its
  // conversion/diligence subroutes (/employers/request-access,
  // /employers/how-it-works). Distinct from /employer (singular), the
  // PROTECTED workspace. The middleware always served these anonymously;
  // declaring them closes the ROUTE-01 drift entry instead of baselining it.
  /^\/employers(\/.*)?$/,
  /^\/search(\/.*)?$/, // public search
  /^\/p(\/.*)?$/, // public clinician profiles — /p/:npi and subpaths
  // Public provider directory — /directory/:npi. Deliberately anonymous and
  // indexable: it renders only the federal registry filing for an NPI, which
  // is already public record at npiregistry.cms.hhs.gov. It carries no
  // VitalCV-held data about the clinician and no employer-side signal.
  /^\/directory(\/.*)?$/,
  /^\/updates(\/.*)?$/, // public updates / changelog
  /^\/apply(\/.*)?$/, // public apply flow
  /^\/intake(\/.*)?$/,
  /^\/review(\/.*)?$/, // public review packet links
  /^\/verify(\/.*)?$/,
  /^\/trust-state(\/.*)?$/,
  /^\/compliance(\/.*)?$/, // compliance & security posture
  /^\/clip(\/.*)?$/, // App Clip zero-install verification receipts
  /^\/\.well-known(\/.*)?$/, // OS association manifests (AASA, assetlinks)
  /^\/auth\/error$/,
  /^\/auth\/resolving$/, // role-resolution interstitial (self-resolves via /api/auth/resolve-role)
  /^\/api(\/.*)?$/, // API routes handle their own auth
];

/**
 * Check if a pathname is a public route.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((p) => p.test(pathname));
}

/**
 * Get the required role for a pathname, or null if public/unprotected.
 */
export function getRequiredRole(pathname: string): UserRoleType | null {
  for (const route of PROTECTED_ROUTES) {
    if (route.pattern.test(pathname)) {
      return route.role;
    }
  }
  return null;
}

/**
 * Get the redirect target for a role mismatch.
 * /internal/** mismatches redirect to "/" (not role landing).
 */
export function getMismatchRedirect(
  pathname: string,
  userRole: UserRoleType
): string {
  if (pathname.startsWith('/internal')) {
    return '/';
  }
  return ROLE_LANDING[userRole];
}
