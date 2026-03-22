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
  VERIFIER: '/verifier',
  ISSUER: '/issuer',
  ADMIN: '/internal/metrics',
  AUTHENTICATED: '/intelligence',
};

/**
 * Route prefix -> required role mapping.
 * Order matters: more specific prefixes must come first.
 *
 * Surface classification (VCV_UI_DOCTRINE §1):
 *   Public   — /explore, /get-ready, /p/:npi, /verify/:npi, /sign-in, /sign-up, etc.
 *   Clinician — /holder/*, /passport/*, /onboarding/*     → CLINICIAN role
 *   Verifier  — /verifier/*, /employers/*, /issuer/*      → VERIFIER role
 *   Ops/Intel — /intelligence/*, /findings/*, /graph/*, …  → AUTHENTICATED (any)
 *   Internal  — /internal/*, /analytics, /billing,
 *               /mission-ops, /command-center             → ADMIN role
 *
 * /dashboard/cv-builder is legacy (deprecated per doctrine §8).
 * Route is kept alive and clinician-gated to prevent open access until
 * it is migrated to /holder/* or removed.
 */
export const PROTECTED_ROUTES: Array<{ pattern: RegExp; role: UserRoleType }> = [
  { pattern: /^\/holder(\/.*)?$/, role: UserRole.CLINICIAN },
  { pattern: /^\/verifier(\/.*)?$/, role: UserRole.VERIFIER },
  { pattern: /^\/issuer(\/.*)?$/, role: UserRole.ISSUER },
  { pattern: /^\/internal(\/.*)?$/, role: UserRole.ADMIN },
  // Internal / operator surfaces — admin only
  { pattern: /^\/mission-ops(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/analytics(\/.*)?$/, role: UserRole.ADMIN },
  // Wave 4: /billing was previously unguarded (neither protected nor public).
  // Internal surface per doctrine §1 — admin only.
  { pattern: /^\/billing(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/command-center(\/.*)?$/, role: UserRole.ADMIN },
  // Legacy / deprecated routes — gated to prevent open access
  // /dashboard/cv-builder: deprecated per doctrine §8; migrate to /holder/* eventually
  { pattern: /^\/dashboard(\/.*)?$/, role: UserRole.CLINICIAN },
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
  // ── Intelligence suite — fully public (no auth required) ──────────────────
  // Backend enforces read-only access; write/mutation routes handle their own auth.
  /^\/intelligence(\/.*)?$/, // full intelligence surface + subpaths
  /^\/findings(\/.*)?$/, // findings feed + detail
  /^\/providers(\/.*)?$/, // provider directory + detail
  /^\/storylines(\/.*)?$/, // storyline feed + detail
  /^\/graph(\/.*)?$/, // trust graph explorer
  /^\/investigations(\/.*)?$/, // investigation workbench
  /^\/actions(\/.*)?$/, // recommended actions
  /^\/network(\/.*)?$/, // network telemetry
  /^\/calibration(\/.*)?$/, // investigator calibration
  /^\/system-health(\/.*)?$/, // system health surface
  // ── Other public surfaces ─────────────────────────────────────────────────
  /^\/simulation(\/.*)?$/, // public simulation surface
  /^\/mobile(\/.*)?$/, // mobile landing
  /^\/status(\/.*)?$/, // public system status
  /^\/developers(\/.*)?$/, // public developer docs
  /^\/investors(\/.*)?$/, // public investor page
  /^\/partners(\/.*)?$/, // public partners page
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/get-ready(\/.*)?$/, // clinician onboarding
  /^\/explore(\/.*)?$/, // public opportunities board
  /^\/search(\/.*)?$/, // public search
  /^\/p\/(\/.*)?$/, // public clinician profiles
  /^\/intake(\/.*)?$/,
  /^\/verify(\/.*)?$/,
  /^\/trust-state(\/.*)?$/,
  /^\/clip(\/.*)?$/, // App Clip zero-install verification receipts
  /^\/\.well-known(\/.*)?$/, // OS association manifests (AASA, assetlinks)
  /^\/auth\/error$/,
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
