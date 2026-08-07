/**
 * The employer job-to-start workflow (EMP-6.1) — the demand-side mirror of the
 * homepage clinician journey (`components/home/journey.ts`).
 *
 * This is an honest MODEL of how the workflow works, in the register of
 * `/evidence-network`: it explains the loop without fabricating people,
 * employers, candidates, or outcomes. It makes no per-stage "available today"
 * claim — the real surfaces (claim form, `/review`) carry their own live state.
 *
 * The three non-negotiable boundaries are baked into the copy, not left to a
 * footnote:
 *   - identity ≠ authority (an org NPI confirms who you are, not legal power);
 *   - the clinician owns sharing (a packet appears only with their consent);
 *   - acceptance ≠ credentialing (a head start, never the committee's decision).
 */

export interface EmployerStage {
  /**
   * Stable key. Was `ordinal: '01'…'06'`, rendered as a two-digit label above
   * each stage title — the `01–06` step numbering CD-13 retires, grouped there
   * with giant metric counters and percentage rings as counting theatre.
   *
   * The span carrying it was already `aria-hidden`, which settles what it was
   * worth: it told a screen-reader user nothing, so it was decoration that
   * happened to look like information. Order is carried by DOM order and the
   * grid, which is where order actually lives.
   */
  id: string;
  title: string;
  body: string;
  /** The one boundary or honesty rail this stage must state, if any. */
  boundary?: string;
}

export const EMPLOYER_STAGES: readonly EmployerStage[] = [
  {
    id: 'request-access',
    title: 'Request organization access',
    body: 'Find your organization by its Type 2 NPI against NPPES, then request access for your account.',
    boundary: 'Identity only. Resolving an organization in NPPES is not authority to act for it — access is granted separately.',
  },
  {
    id: 'define-requirements',
    title: 'Define what the role requires',
    body: 'State what the role needs; requirements become the checklist every packet is measured against — nothing is graded against a hidden bar.',
  },
  {
    id: 'receive-packet',
    title: 'Receive a consented packet',
    body: 'A clinician shares a source-backed readiness packet with your organization.',
    boundary: 'You see a record only when the clinician shares it. No silent sourcing, no anonymous directory.',
  },
  {
    id: 'review-coverage',
    title: 'Review coverage and blockers',
    body: 'Every claim names its source, state, and freshness — checked reads as checked, gated as gated, blockers as blockers, never one green light over an unproven record.',
  },
  {
    id: 'accept-head-start',
    title: 'Accept as a head start',
    body: 'Recognize the packet to move a clinician toward starting sooner, and resolve what remains together.',
    boundary: 'Acceptance is a head start, not credentialing. Your committee keeps the hiring and privileging decision.',
  },
  {
    id: 'reach-start-ready',
    title: 'Reach start-ready',
    body: 'Work the remaining requirements down to start-ready — every step attributable and recorded, auditable end to end.',
  },
] as const;
