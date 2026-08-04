/**
 * Whether the `/design/*` reference surfaces may be served.
 *
 * These are internal design references — historical implementations kept so a
 * decision can be compared against what it replaced. They were reachable in
 * production (HTTP 200), and only `robots.txt` kept them out of search. That
 * is not a gate: `Disallow` is a request to crawlers, not an access control,
 * and it does nothing about a pasted link or a curious visitor.
 *
 * It mattered because a reference is frozen ON PURPOSE. `/design/wave1501`
 * still renders the drag-rotate career constellation that CD-13 retired, and
 * that is CORRECT for a reference — the whole point is to show what wave 1501
 * looked like. What was wrong is that a frozen reference was reachable by the
 * public, which put doctrine and history in direct conflict: either the
 * reference lies about the past, or production ships a retired mechanism.
 *
 * Gating the route resolves it without having to choose. Modelled on
 * `isCareerGardenPreviewAllowed` — including the RAILWAY_ENVIRONMENT check,
 * since Railway is the deploy target and NODE_ENV alone would also hide these
 * from a local production build, where they are genuinely useful.
 */

export interface DesignPreviewEnvironment {
  NODE_ENV?: string;
  RAILWAY_ENVIRONMENT?: string;
  VERCEL_ENV?: string;
  DESIGN_PREVIEW?: string;
}

export function isDesignPreviewAllowed(env: DesignPreviewEnvironment): boolean {
  if (env.NODE_ENV !== 'production') return true;

  const isCanonicalProduction =
    env.RAILWAY_ENVIRONMENT?.trim().toLowerCase() === 'production'
    || env.VERCEL_ENV?.trim().toLowerCase() === 'production';

  // A local or preview production build still serves them, so `next start`
  // remains a usable way to check a reference. Canonical production never does,
  // and DESIGN_PREVIEW cannot override that — an escape hatch on the one
  // environment this exists to protect would defeat the gate.
  if (isCanonicalProduction) return false;

  return env.DESIGN_PREVIEW === '1';
}
