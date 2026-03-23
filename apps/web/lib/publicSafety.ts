/**
 * publicSafety.ts — Route and content safety gates
 *
 * isPublicSafe(path) — returns true if a route is safe to expose publicly.
 * Used to hide internal/incomplete/operator surfaces from public nav and links.
 *
 * Principle: if it is not real, complete, and trustworthy — it is not public.
 *
 * BLOCKED from public navigation (auth-gated or hidden):
 *   /intelligence*  — ops intelligence surface (auth-gated separately)
 *   /calibration*   — internal accuracy dashboard
 *   /simulation*    — trust simulation engine (operator tool)
 *   /graph*         — graph explorer (operator tool)
 *   /network*       — network telemetry (operator tool)
 *   /findings*      — investigation findings feed
 *   /storylines*    — narrative engine
 *   /providers*     — provider directory (operator)
 *   /actions*       — action engine
 *   /investigations*— investigation detail
 *   /mission-ops*   — operational dashboard
 *   /mission-control* — operator control
 *   /command-center*  — operator command surface
 */

const BLOCKED_PUBLIC_PATTERNS: RegExp[] = [
  /^\/intelligence(\/.*)?$/,
  /^\/calibration(\/.*)?$/,
  /^\/simulation(\/.*)?$/,
  /^\/graph(\/.*)?$/,
  /^\/network(\/.*)?$/,
  /^\/findings(\/.*)?$/,
  /^\/storylines(\/.*)?$/,
  /^\/providers(\/.*)?$/,
  /^\/actions(\/.*)?$/,
  /^\/investigations(\/.*)?$/,
  /^\/mission-ops(\/.*)?$/,
  /^\/mission-control(\/.*)?$/,
  /^\/command-center(\/.*)?$/,
  /^\/analytics(\/.*)?$/,
  /^\/billing(\/.*)?$/,
  /^\/dashboard(\/.*)?$/,
  /^\/verifier(\/.*)?$/,
];

export function isPublicSafe(path: string): boolean {
  const clean = path.split('?')[0] ?? path;
  return !BLOCKED_PUBLIC_PATTERNS.some(re => re.test(clean));
}

/**
 * Sanitize a claim for public display.
 * Replaces known overclaiming strings with honest equivalents.
 */
export const CLAIM_REWRITES: Record<string, string> = {
  'accepted everywhere':   'designed for reuse across employers',
  'under 24 hours':        'as fast as the underlying source allows',
  '3–6 weeks faster':      'faster than manual credentialing',
  '3-6 weeks faster':      'faster than manual credentialing',
  '99.9% uptime':          'high availability target',
  'v1 stable':             'v1',
  '98% faster':            'significantly faster',
  'launch-safe':           'structured',
  '1,200+':                '',
};
