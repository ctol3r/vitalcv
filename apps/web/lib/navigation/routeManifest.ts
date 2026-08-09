/**
 * The route manifest — UX-03.
 *
 * One declarative table naming, for every product surface, its human label and
 * its parent. The breadcrumb trail is derived from this table, never from
 * splitting the pathname: a naive split renders "[applicationId]" or
 * "Applicationid" on the eleven dynamic routes, and cannot know that
 * /employer/decision/:id belongs under the review queue rather than under a
 * literal "decision" folder that no page serves.
 *
 * The manifest is also the audit surface. navigation-contract.test.ts asserts
 * that every product route has an entry and that every parent chain terminates
 * at a real route, so a new page cannot ship without a navigation decision.
 *
 * SCOPE — this file is presentation only. It decides what a surface is called
 * and what sits above it. It grants no access: membership here never widens
 * `isPublicSurfacePath`, and middleware remains the sole auth gate.
 */

/** The product sections a signed-in person can be working inside. */
export type ProductSection = 'clinician' | 'employer' | 'issuer' | 'admin' | 'ops' | 'account';

export interface RouteNode {
  /** Human label. Sentence case, no jargon — EC-9 vocabulary applies. */
  label: string;
  /** Parent route pattern. `null` marks a section root. */
  parent: string | null;
  /** Which product section this surface belongs to. */
  section: ProductSection;
  /**
   * Set when the route is a waypoint with no page of its own (e.g.
   * /employer/decision). It renders in the trail as plain text, never a link,
   * because clicking it would 404.
   */
  unlinked?: boolean;
}

/**
 * Route patterns use Next's own dynamic-segment syntax so an entry is
 * greppable from the `app/` directory it describes.
 */
export const ROUTE_MANIFEST: Record<string, RouteNode> = {
  // ── Clinician ────────────────────────────────────────────────────────────
  '/holder/home': { label: 'Home', parent: null, section: 'clinician' },
  '/holder': { label: 'Home', parent: null, section: 'clinician' },
  '/holder/readiness': { label: 'Readiness', parent: '/holder/home', section: 'clinician' },
  '/holder/recognition': { label: 'Recognition', parent: '/holder/home', section: 'clinician' },
  '/holder/timeline': { label: 'Timeline', parent: '/holder/home', section: 'clinician' },
  '/holder/scoreboard': { label: 'Scoreboard', parent: '/holder/home', section: 'clinician' },
  '/holder/settings': { label: 'Settings', parent: '/holder/home', section: 'account' },

  '/holder/applications': { label: 'Applications', parent: '/holder/home', section: 'clinician' },
  '/holder/applications/[id]': {
    label: 'Application',
    parent: '/holder/applications',
    section: 'clinician',
  },
  '/holder/blockers/[blockerId]': {
    label: 'Blocker',
    parent: '/holder/readiness',
    section: 'clinician',
  },

  '/holder/opportunities': { label: 'Opportunities', parent: '/holder/home', section: 'clinician' },
  '/holder/opportunities/discover': {
    label: 'Discover',
    parent: '/holder/opportunities',
    section: 'clinician',
  },
  '/holder/opportunities/interested': {
    label: 'Interested',
    parent: '/holder/opportunities',
    section: 'clinician',
  },
  '/holder/opportunities/passed': {
    label: 'Passed',
    parent: '/holder/opportunities',
    section: 'clinician',
  },
  '/holder/opportunities/[id]': {
    label: 'Opportunity',
    parent: '/holder/opportunities',
    section: 'clinician',
  },

  '/holder/garden': { label: 'Career garden', parent: '/holder/home', section: 'clinician' },
  '/holder/garden/cv': { label: 'CV', parent: '/holder/garden', section: 'clinician' },
  '/holder/garden/notes': { label: 'Notes', parent: '/holder/garden', section: 'clinician' },
  '/holder/garden/opportunities': {
    label: 'Opportunities',
    parent: '/holder/garden',
    section: 'clinician',
  },
  '/holder/garden/privacy': { label: 'Privacy', parent: '/holder/garden', section: 'clinician' },
  '/holder/garden/research': { label: 'Research', parent: '/holder/garden', section: 'clinician' },

  '/holder/matcha': { label: 'Matches', parent: '/holder/home', section: 'clinician' },
  '/holder/matcha/onboarding': { label: 'Set up', parent: '/holder/matcha', section: 'clinician' },
  '/holder/matcha/assessment': {
    label: 'Assessment',
    parent: '/holder/matcha',
    section: 'clinician',
  },
  '/holder/matcha/opportunities': {
    label: 'Opportunities',
    parent: '/holder/matcha',
    section: 'clinician',
  },

  '/clinician/profile': { label: 'Profile', parent: '/holder/home', section: 'clinician' },

  // ── Employer ─────────────────────────────────────────────────────────────
  '/employer/dashboard': { label: 'Dashboard', parent: null, section: 'employer' },
  '/employer/worklist': { label: 'Worklist', parent: '/employer/dashboard', section: 'employer' },
  '/employer/candidates': {
    label: 'Candidates',
    parent: '/employer/dashboard',
    section: 'employer',
  },
  '/employer/post': { label: 'Post a role', parent: '/employer/dashboard', section: 'employer' },
  '/employer/profile': {
    label: 'Organization profile',
    parent: '/employer/dashboard',
    section: 'account',
  },

  '/employer/applications': {
    label: 'Applications',
    parent: '/employer/dashboard',
    section: 'employer',
  },
  '/employer/applications/[applicationId]': {
    label: 'Application',
    parent: '/employer/applications',
    section: 'employer',
  },
  '/employer/review-queue': {
    label: 'Review queue',
    parent: '/employer/dashboard',
    section: 'employer',
  },
  '/employer/review/[applicationId]': {
    label: 'Review',
    parent: '/employer/review-queue',
    section: 'employer',
  },
  '/employer/decision/[applicationId]': {
    label: 'Decision',
    parent: '/employer/review-queue',
    section: 'employer',
  },

  // ── Issuer ───────────────────────────────────────────────────────────────
  // The issuer tree has no index page: every surface is keyed by a request a
  // verifier arrives on. The section root is therefore an unlinked waypoint —
  // it names where you are without offering a link that would 404.
  '/issuer': { label: 'Issuer', parent: null, section: 'issuer', unlinked: true },
  '/issuer/request/[requestId]': { label: 'Request', parent: '/issuer', section: 'issuer' },
  '/issuer/review/[requestId]': {
    label: 'Review',
    parent: '/issuer/request/[requestId]',
    section: 'issuer',
  },
  '/issuer/verify/[requestId]': {
    label: 'Verify',
    parent: '/issuer/request/[requestId]',
    section: 'issuer',
  },
  '/issuer/policy-review/[requestId]': {
    label: 'Policy review',
    parent: '/issuer/review/[requestId]',
    section: 'issuer',
  },
  '/issuer/psv-receipt/[requestId]': {
    label: 'Receipt candidate',
    parent: '/issuer/policy-review/[requestId]',
    section: 'issuer',
  },
  '/issuer/psv-reuse/[receiptId]': {
    label: 'Reuse',
    parent: '/issuer',
    section: 'issuer',
  },
  '/issuer/audit-boundary/[requestId]': {
    label: 'Audit boundary',
    parent: '/issuer/review/[requestId]',
    section: 'issuer',
  },
  '/issuer/backend-persistence/[requestId]': {
    label: 'Persistence',
    parent: '/issuer/review/[requestId]',
    section: 'issuer',
  },
  '/issuer/persistence-adapter/[requestId]': {
    label: 'Persistence adapter',
    parent: '/issuer/review/[requestId]',
    section: 'issuer',
  },

  // ── Admin ────────────────────────────────────────────────────────────────
  '/admin/platform': { label: 'Platform', parent: null, section: 'admin' },
  '/admin/leads': { label: 'Leads', parent: '/admin/platform', section: 'admin' },
  '/admin/demo-reset': { label: 'Demo reset', parent: '/admin/platform', section: 'admin' },
  '/admin/agent-ops': { label: 'Agent Ops', parent: '/admin/platform', section: 'admin' },

  // ── Ops ──────────────────────────────────────────────────────────────────
  '/ops': { label: 'Operations', parent: null, section: 'ops' },
  '/ops/engine': { label: 'Engine', parent: '/ops', section: 'ops' },
  '/ops/survivability': { label: 'Survivability', parent: '/ops', section: 'ops' },
};

/** Section roots, for the product bar's section switcher. */
export const SECTION_ROOTS: Record<ProductSection, string> = {
  clinician: '/holder/home',
  employer: '/employer/dashboard',
  issuer: '/issuer',
  admin: '/admin/platform',
  ops: '/ops',
  account: '/holder/settings',
};

/**
 * Match a concrete pathname to its manifest pattern.
 *
 * Exact hits win; otherwise a segment-wise comparison lets `[param]` absorb one
 * segment. Segment count must match, so /employer/applications never captures
 * /employer/applications/abc.
 */
export function matchRoutePattern(pathname: string): string | null {
  const clean = normalize(pathname);
  if (ROUTE_MANIFEST[clean]) return clean;

  const parts = clean.split('/').filter(Boolean);
  let best: string | null = null;
  let bestStatic = -1;

  for (const pattern of Object.keys(ROUTE_MANIFEST)) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;

    let ok = true;
    let staticCount = 0;
    for (let i = 0; i < pp.length; i += 1) {
      const seg = pp[i];
      if (seg.startsWith('[') && seg.endsWith(']')) continue;
      if (seg !== parts[i]) {
        ok = false;
        break;
      }
      staticCount += 1;
    }
    // Prefer the most literal pattern, so /issuer/review/[id] beats a
    // hypothetical /[a]/[b]/[c].
    if (ok && staticCount > bestStatic) {
      best = pattern;
      bestStatic = staticCount;
    }
  }
  return best;
}

export interface TrailItem {
  label: string;
  /** Absent when the node is an unlinked waypoint or is the current page. */
  href?: string;
  /** True for the current page, which renders with aria-current="page". */
  current?: boolean;
}

/**
 * Build the breadcrumb trail for a pathname.
 *
 * Dynamic segments are substituted back from the live pathname, so
 * /employer/review/abc under parent /employer/review-queue yields a trail whose
 * links point at real URLs. `labels` lets a page supply a resolved human name
 * for its own crumb ("Dr. Reyes" instead of "Application") once it has loaded
 * the record.
 */
export function resolveTrail(
  pathname: string,
  labels: Record<string, string> = {},
): TrailItem[] {
  const start = matchRoutePattern(pathname);
  if (!start) return [];

  const clean = normalize(pathname);
  const actual = clean.split('/').filter(Boolean);

  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = start;
  // Guard against a manifest edit introducing a parent cycle: the test gate
  // catches it, but a cycle must never hang a render.
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    chain.unshift(cursor);
    cursor = ROUTE_MANIFEST[cursor]?.parent ?? null;
  }

  return chain.map((pattern, index) => {
    const node = ROUTE_MANIFEST[pattern];
    const isCurrent = index === chain.length - 1;
    const label = labels[pattern] ?? node.label;

    if (isCurrent) return { label, current: true };
    if (node.unlinked) return { label };

    // Rebuild a concrete href by borrowing the live pathname's own values for
    // any dynamic segment. An ancestor is always a prefix of the current route,
    // so the positional read is safe.
    const segs = pattern.split('/').filter(Boolean);
    const href = `/${segs
      .map((seg, i) => (seg.startsWith('[') && seg.endsWith(']') ? actual[i] ?? seg : seg))
      .join('/')}`;
    return { label, href };
  });
}

function normalize(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.split('?')[0].split('#')[0];
  return trimmed.length > 1 && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}
