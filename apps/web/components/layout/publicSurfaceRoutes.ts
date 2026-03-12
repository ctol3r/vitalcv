export const PUBLIC_SURFACE_PATHS = new Set([
  '/',
  '/developers',
  '/documents',
  '/mission-ops',
  '/mobile',
  '/network',
  '/simulation',
  '/status',
  '/explore',
  '/employers',
  '/search',
  '/ask',
  '/get-ready',
  '/investors',
  '/partners',
]);

const PREFIX_MATCHERS = [
  '/demo',
  '/sign-in',
  '/sign-up',
  '/employers',
  '/opportunities',
  '/docs',
  '/p',
  '/verify',
  '/clip',
] as const;

export function isPublicSurfacePath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  if (PUBLIC_SURFACE_PATHS.has(pathname)) {
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
