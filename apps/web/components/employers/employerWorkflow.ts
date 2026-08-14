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
 *
 * DL-005 (2026-08-07, hierarchy pass): every stage now carries its qualifier in
 * `boundary` rather than three of them burying it mid-sentence in `body`. The
 * renderer already gave `boundary` its own treatment — mono, accent rule, muted —
 * so half the stages were rendering their honesty rail as a visible rail and half
 * were hiding it inside a longer paragraph. Same words, same claims: nothing was
 * softened or dropped, and the qualifier is now legible in the stages where it was
 * least visible. Bodies are one scannable line each; recruiters scan.
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
    body: 'State what the role needs. Requirements become the checklist every packet is measured against.',
    boundary: 'Nothing is graded against a hidden bar.',
  },
  {
    id: 'receive-packet',
    title: 'Receive the exact packet',
    body: 'The submitted version preserves the fields, sources, freshness, purpose, recipient, and consent the clinician chose.',
    boundary: 'You see a record only when the clinician shares it. Current evidence never silently replaces the submission.',
  },
  {
    id: 'review-coverage',
    title: 'Inspect or ask for clarification',
    body: 'Read each source state and freshness, then ask about an open item without losing the submitted version.',
    boundary: 'Checked reads as checked, gated as gated, and open stays open — never one green light over an unproven record.',
  },
  {
    id: 'accept-head-start',
    title: 'Accept as a head start',
    body: 'Recognize the packet to move a clinician toward starting sooner, and resolve what remains together.',
    boundary: 'Acceptance is a head start, not credentialing. Your committee keeps the hiring and privileging decision.',
  },
  {
    id: 'reach-start-ready',
    title: 'Keep start events distinct',
    body: 'Continue institution review while credentialing start, intended start, and actual start remain separate events.',
    boundary: 'A head start is not a hire or a start. Every later step keeps its own actor, time, and scope.',
  },
] as const;
