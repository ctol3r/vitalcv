/**
 * navDestinations — the single source of truth for public navigation
 * destinations. The desktop navigation canvas and the mobile overlay both
 * consume this list; neither may carry its own copy (a duplicated array is
 * how desktop and mobile drift apart).
 *
 * Every href below is a route that exists and returns 200. The standing rule
 * is "never a dead link": `holder-route-contract` extracts hrefs from raw
 * source and asserts each one resolves, so an aspirational entry fails CI
 * rather than shipping a 404. A **Company** group was requested and remains
 * deliberately absent for exactly that reason — there is no /about or
 * /careers in `app/` today. It goes in the moment those pages exist.
 *
 * Wave 1079 adds a second rule the first one could not catch: a destination in
 * PUBLIC navigation must be reachable by a signed-out visitor, not merely
 * exist. `/opportunities/discover` satisfied "resolves" — it 307s to
 * `/holder/opportunities/discover`, which 307s to `/sign-in` — so the clinician
 * group's jobs link walled a cold visitor at "Welcome back to VitalCV". The
 * public jobs board is `/explore`, which is built for exactly this reader
 * ("Signed in with your NPI linked, the board also shows which requirements
 * your record already satisfies") and was reachable from no navigation at all.
 * `public-nav-reachability` now asserts every href here is a public surface.
 */

export interface NavLink {
  href: string;
  label: string;
  detail: string;
}

export interface NavGroup {
  id: 'clinicians' | 'employers' | 'trust';
  label: string;
  blurb: string;
  links: readonly NavLink[];
}

/**
 * The eyebrow bar's primary destinations — W1079's "collapse to clinician-first"
 * list, in the order a clinician needs them.
 *
 * Lives here rather than inline in `Eyebrow.tsx` for the same reason the groups
 * do: the bar, the index menu and the footer are three renderings of one
 * information architecture, and a bar that carries its own private array is how
 * they drift. It also means `public-nav-reachability` can see every public
 * destination from one import instead of parsing JSX.
 *
 * "Build your profile" is deliberately NOT here — it is the bar's CTA button
 * (`headerRouteContext`), and a nav link beside a button pointing at the same
 * action is the competing-primary problem that config already avoids.
 */
export const PRIMARY_NAV: readonly NavLink[] = [
  { href: '/explore', label: 'Jobs', detail: 'Open roles, with the requirements shown up front' },
  { href: '/employers', label: 'For employers', detail: 'What arrives, and what it does not decide' },
  // The one fragment in the bar. It is honest from any public route: the target
  // section lives on the homepage, so this navigates home and anchors there.
  { href: '/#how-it-works', label: 'How it works', detail: 'The loop, end to end' },
] as const;

/**
 * Footer destinations. W1079 moved Trust and Status off the bar into this
 * "compact footer path"; the legal and pilot links were already here.
 */
export const FOOTER_NAV: readonly NavLink[] = [
  { href: '/trust', label: 'Trust', detail: 'What VitalCV does and does not decide' },
  { href: '/status', label: 'Status', detail: 'Source and system state' },
  { href: '/privacy', label: 'Privacy', detail: 'How data is handled' },
  { href: '/terms', label: 'Terms', detail: 'Terms of service' },
  { href: '/legal/dpa', label: 'DPA', detail: 'Data processing agreement' },
  { href: '/legal/cookies', label: 'Cookies', detail: 'Cookie policy' },
  { href: '/pilot', label: 'Start a Pilot', detail: 'For employers evaluating VitalCV' },
  { href: '/contact', label: 'Contact', detail: 'Reach the team' },
] as const;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'clinicians',
    label: 'Clinicians',
    // Deliberately does NOT repeat the hero's "Start with your NPI". The panel
    // sits before the page content in DOM order and is hidden while collapsed,
    // so a shared phrase makes `getByText(...).first()` resolve to an invisible
    // node — which is exactly how this broke the homepage's own copy assertion.
    blurb: 'One reusable profile, built from the sources employers already trust.',
    links: [
      { href: '/onboarding', label: 'Build your profile', detail: 'Begin with your NPI' },
      { href: '/explore', label: 'Jobs', detail: 'Open roles, with the requirements shown up front' },
    ],
  },
  {
    id: 'employers',
    label: 'Employers',
    blurb: 'Begin review from attributed evidence instead of from intake.',
    links: [
      { href: '/employers', label: 'For employers', detail: 'What arrives, and what it does not decide' },
      { href: '/pricing', label: 'Pricing', detail: 'Plain terms, stated' },
    ],
  },
  /*
   * Wave 1077 IA correction: `Evidence` was a fifth top-level concept, and a
   * customer is meant to hold four (VitalCV, their profile, VitalCV Jobs,
   * Apply with VitalCV). "Evidence" names the machinery. Both of its pages are
   * real and keep working — they moved UNDER Trust, which is already where a
   * visitor goes to ask what this company actually knows.
   */
  {
    id: 'trust',
    label: 'Trust',
    blurb: 'The boundary is published, not implied.',
    links: [
      { href: '/trust', label: 'Trust', detail: 'What VitalCV does and does not decide' },
      { href: '/status', label: 'Status', detail: 'Source and system state' },
      { href: '/trust/attribution', label: 'Source attribution', detail: 'Which source answered for what' },
      { href: '/evidence-network', label: 'Evidence network', detail: 'How records move between parties' },
    ],
  },
] as const;

/** Every destination across all groups, used by the no-duplicates test. */
export function allNavHrefs(): string[] {
  return NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));
}

/**
 * Every public navigation destination, across all three renderings. This is
 * what the reachability guard walks — the bar, the index menu and the footer
 * together, so no surface can quietly advertise a route a signed-out visitor
 * cannot reach.
 */
export function allPublicNavHrefs(): string[] {
  return [
    ...PRIMARY_NAV.map((l) => l.href),
    ...allNavHrefs(),
    ...FOOTER_NAV.map((l) => l.href),
  ];
}
