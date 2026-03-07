// apps/web/lib/auth/roles.ts
//
// Canonical role definitions, route-role mappings, and post-login redirects.
// Used by middleware, components, and tests.

export const UserRole = {
  CLINICIAN: 'CLINICIAN',
  VERIFIER: 'VERIFIER',
  ISSUER: 'ISSUER',
  ADMIN: 'ADMIN',
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
};

/**
 * Route prefix -> required role mapping.
 * Order matters: more specific prefixes must come first.
 */
export const PROTECTED_ROUTES: Array<{ pattern: RegExp; role: UserRoleType }> = [
  { pattern: /^\/holder(\/.*)?$/, role: UserRole.CLINICIAN },
  { pattern: /^\/verifier(\/.*)?$/, role: UserRole.VERIFIER },
  { pattern: /^\/issuer(\/.*)?$/, role: UserRole.ISSUER },
  { pattern: /^\/internal(\/.*)?$/, role: UserRole.ADMIN },
  // Wave 136: Operator console — admin only
  { pattern: /^\/mission-ops(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/analytics(\/.*)?$/, role: UserRole.ADMIN },
  { pattern: /^\/command-center(\/.*)?$/, role: UserRole.ADMIN },
];

/**
 * Routes that never require authentication.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/, // landing
  /^\/demo(\/.*)?$/, // interactive demo — no auth required
  /^\/network(\/.*)?$/, // public trust network map
  /^\/simulation(\/.*)?$/, // public simulation surface
  /^\/mobile(\/.*)?$/, // mobile landing
  /^\/status(\/.*)?$/, // public system status
  /^\/developers(\/.*)?$/, // public developer docs
  /^\/investors(\/.*)?$/, // public investor page
  /^\/partners(\/.*)?$/, // public partners page
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
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
