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
  '/onboarding',
  '/investors',
  '/partners',
  '/updates',
  '/pilot',
  '/status',
  '/compliance',
  '/privacy',
  '/terms',
  '/contact',
  '/trust',
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
  // COMPETE-2 film spike: a full-viewport composition cannot be evaluated with
  // a promo rail over its first scene. Scoped to this ONE harness rather than
  // all of /dev, so the other dev routes keep the chrome their tests expect.
  '/dev/compete-film',
  // NOTE: /evidence-network is no longer self-chromed — the public route is a
  // static transparency page (SHD-0.3 quarantine) rendered with standard site
  // chrome; the explorable graph lives on signed-in surfaces only.
] as const;

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
  '/trust',
  '/legal',
  '/matcha',
  '/for',
  '/solutions',
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
