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
      { href: '/opportunities/discover', label: 'Opportunities', detail: 'Roles that fit the profile you hold' },
    ],
  },
  {
    id: 'employers',
    label: 'Employers',
    blurb: 'Begin review from attributed evidence instead of from intake.',
    links: [
      { href: '/employers', label: 'For employers', detail: 'What arrives, and what it does not decide' },
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
