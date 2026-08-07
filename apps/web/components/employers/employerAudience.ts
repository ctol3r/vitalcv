/**
 * MB1 (dual-audience) — who the employer surface is FOR, by team and by org size.
 *
 * Both blocks below close positions the competitive study found empty across all
 * 28 surveyed companies (docs/research/competitor-message-brand-study-2026-07-26.md):
 *
 *   - W10 — the daily user by title. §9.3: every modern credentialing vendor pitches
 *     upward to finance and operations leadership ("Finance & revenue leaders",
 *     VP Network Operations, COO) and has written the person who actually runs the
 *     file out of the story. Only the incumbents still name the MSP. Naming them is
 *     free and unoccupied.
 *   - W11 — org size. §9.4: only HealthStream has a real size ladder, and NOBODY
 *     sells the small practice, where the office manager IS the credentialing team.
 *     Everyone else segments by purchasing shape (payer / system / digital health),
 *     which is not the same question.
 *
 * Vocabulary is deliberately native to the buyer (§9.2 audited term list): primary
 * source verification, expirables, re-credentialing, privileging, committee file,
 * provider onboarding. Two conventions are honoured — "provider onboarding" is the
 * umbrella term the whole field uses, and payer enrollment is never conflated with
 * credentialing.
 *
 * Honesty rails, same as `employerWorkflow.ts`: no fabricated customers, no metrics,
 * no outcome claims, and nothing that implies VitalCV performs credentialing or
 * displaces the committee. What is described is what the packet shows.
 */

export interface EmployerTeam {
  /** Team as the buyer's own org chart names it. */
  team: string;
  /** What this team sees first — packet-grounded, never a workflow promise. */
  body: string;
  /** The daily users, by their real job titles. Rendered in mono as job facts. */
  roles: readonly string[];
}

// Bodies are single sentences by REVISION 2 (founder visual gate, 2026-08-07):
// the section moved from cards to rows, and a row earns one sentence.
export const EMPLOYER_TEAMS: readonly EmployerTeam[] = [
  {
    team: 'Credentialing & medical staff services',
    body: 'The file starts populated — each answer named to the source that returned it and dated, with an explicit list of what has not been checked.',
    roles: [
      'medical staff services professional (MSP)',
      'credentialing specialist',
      'privileging coordinator',
      'provider enrollment staff',
    ],
  },
  {
    team: 'Recruitment & talent acquisition',
    body: 'See what a candidate still has outstanding before the offer, so the start date you commit to reflects what is actually left.',
    roles: ['recruiter', 'sourcer', 'talent acquisition manager'],
  },
  {
    team: 'HR & onboarding',
    body: 'One consented record carries into onboarding instead of a second document collection in week one.',
    roles: ['HR generalist', 'onboarding coordinator', 'people operations'],
  },
];

export interface EmployerOrgSize {
  /** Size band in the buyer's own words. */
  band: string;
  /** The situation this band is actually in. */
  situation: string;
  /** What changes for them specifically. */
  body: string;
  /** Where this band should start. */
  action: { label: string; href: string };
}

export const EMPLOYER_ORG_SIZES: readonly EmployerOrgSize[] = [
  {
    band: 'Single practice or clinic',
    situation: 'No credentialing department — the office manager is the credentialing team.',
    body: 'The same evidence packet a health system gets, sources named and gaps listed. No CVO contract, nothing to install.',
    action: { label: 'Request organization access', href: '/employers/request-access' },
  },
  {
    band: 'Provider group, staffing firm, MSO or DSO',
    situation: 'Multi-state, high volume, and paying for agency or locum cover while files sit.',
    body: 'Evidence gathered once travels between placements; expirables and re-credentialing dates travel with the record instead of being rediscovered.',
    action: { label: 'Request organization access', href: '/employers/request-access' },
  },
  {
    band: 'Hospital or health system',
    situation: 'You already run a CVO, an applicant tracking system, and a credentialing committee.',
    body: 'A head start for the committee file. It does not replace primary source verification you are required to perform, and appointment and privileging decisions stay with medical staff services.',
    action: { label: 'Request a pilot', href: '/pilot' },
  },
];

/** The boundary this section must state, in the register of the page's other rails. */
export const EMPLOYER_AUDIENCE_BOUNDARY =
  'A head start on evidence is not a credentialing decision. Whatever your size, the appointment decision stays yours.';
