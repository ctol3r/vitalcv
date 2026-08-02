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
  /** Two-digit ordinal, matching the journey's `01 · …` eyebrow grammar. */
  ordinal: string;
  title: string;
  body: string;
  /** The one boundary or honesty rail this stage must state, if any. */
  boundary?: string;
}

export const EMPLOYER_STAGES: readonly EmployerStage[] = [
  {
    ordinal: '01',
    title: 'Request organization access',
    body: 'Find your organization by its Type 2 NPI against NPPES, then request access for your account.',
    boundary: 'Identity only. Resolving an organization in NPPES is not authority to act for it — access is granted separately.',
  },
  {
    ordinal: '02',
    title: 'Define what the role requires',
    body: 'State the credentials, licensure, and readiness a role needs. Requirements become the checklist every packet is measured against — nothing is graded against a hidden bar.',
  },
  {
    ordinal: '03',
    title: 'Receive a consented packet',
    body: 'A clinician shares a source-backed readiness packet with your organization.',
    boundary: 'You see a record only when the clinician shares it. No silent sourcing, no anonymous directory.',
  },
  {
    ordinal: '04',
    title: 'Review coverage and blockers',
    body: 'Every claim names its source, state, and freshness. Checked lanes read as checked; access-gated lanes read as gated; blockers read as blockers — never a single green light over an unproven record.',
  },
  {
    ordinal: '05',
    title: 'Accept as a head start',
    body: 'Recognize the packet to move a clinician toward starting sooner, and resolve the remaining requirements together.',
    boundary: 'Acceptance is a head start, not credentialing. Your committee keeps the hiring and privileging decision.',
  },
  {
    ordinal: '06',
    title: 'Reach start-ready',
    body: 'Work the remaining requirements down until the role is start-ready. Every step is attributable and recorded, so the path from interest to start is auditable end to end.',
  },
] as const;
