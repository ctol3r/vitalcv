// Public surface paths: routes that show the Navbar + Footer (no auth required).
// Rules:
//   - Do NOT add ops/intelligence routes here (/mission-ops, /intelligence, /graph, etc.)
//   - Do NOT add auth-gated routes here (/holder, /verifier, etc.)
// See docs/VCV_UI_DOCTRINE.md §2 for classification rules.
export const PUBLIC_SURFACE_PATHS = new Set([
  '/',
  '/developers',
  '/documents',
  '/mobile',
  '/explore',
  '/employers',
  '/search',
  '/ask',
  '/get-ready',
  '/investors',
  '/partners',
  '/updates',
  '/pilot',
  '/status',
  '/compliance',
  '/privacy',
  '/terms',
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
] as const;

// Routes whose page components OWN their own chrome (Nav + Footer) and
// must NOT receive the global marketing Navbar/Footer. The visual-system
// port (D57 Calm Wave) provides its own paper-substrate shell on every
// page in this list, scoped under `.vs-root`.
//
// Each entry is either an exact path (string equality required) or a
// prefix marked with a trailing '/*' (matches the path itself and any
// deeper subpath). Subroutes that aren't covered fall back to the global
// chrome.
export const VISUAL_SYSTEM_OWNED_ROUTES = [
  '/',                       // homepage
  '/passport/*',             // passport ingest + view (own chrome via FooterBottom)
  '/sign-in/*',              // Clerk catch-all wrapped in AuthShell
  '/sign-up/*',              // Clerk catch-all wrapped in AuthShell
  '/trust',                  // exact — /trust/doctrine keeps its existing chrome
  '/trust/attribution/*',
  '/status',                 // exact
  '/contact',                // exact
] as const;

export function isVisualSystemOwnedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return VISUAL_SYSTEM_OWNED_ROUTES.some((entry) => {
    if (entry.endsWith('/*')) {
      const prefix = entry.slice(0, -2);
      return pathname === prefix || pathname.startsWith(`${prefix}/`);
    }
    return pathname === entry;
  });
}

const PREFIX_MATCHERS = [
  '/demo',
  '/sign-in',
  '/sign-up',
  '/passport',
  '/review',
  '/employers',
  '/opportunities',
  '/docs',
  '/compliance',
  '/p',
  '/review',
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
