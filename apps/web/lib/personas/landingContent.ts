import type { PilotIntakePersona } from '@/lib/pilot-intake/validate';

/**
 * Persona landing-page content registry.
 *
 * Each entry is the data backing a single /for/<slug>/page.tsx
 * surface. All copy lives here so:
 *   - Adding a new persona is one-line (add an entry + one route file).
 *   - Banned-strings CI scans a single file for compliance copy.
 *   - The CTA always wires through to /contact?persona=<value>, where
 *     <value> is a literal PilotIntakePersona that the form's
 *     validate helper accepts directly.
 *
 * No banned phrases per CLAUDE.md. No bare-word status label per the rule.
 */

export interface PersonaLandingValueProp {
  title: string;
  description: string;
}

export interface PersonaLandingFlowStep {
  step: string;
  title: string;
  description: string;
}

export interface PersonaLandingContent {
  /** URL slug under /for/<slug>. */
  slug: 'cvo' | 'payer' | 'staffing-exchange';
  /** Maps to a literal PilotIntakePersona for the /contact form. */
  intakePersona: PilotIntakePersona;
  /** Browser title + og:title. */
  title: string;
  /** Meta description + og:description. */
  description: string;
  /** Page hero — eyebrow / headline / subhead. */
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
  };
  /** Three-up value proposition row. */
  valueProps: ReadonlyArray<PersonaLandingValueProp>;
  /** "How VitalCV fits your flow" steps. */
  flow: ReadonlyArray<PersonaLandingFlowStep>;
  /** Closing CTA copy. */
  cta: {
    headline: string;
    body: string;
    button: string;
  };
}

// `title` feeds generateMetadata ONLY (each /for/* page passes it straight to
// `metadata.title`); the visible heading comes from `hero`. It must therefore
// NOT carry the brand: app/layout.tsx sets `template: '%s — VitalCV'`, so these
// three rendered as "For CVOs — VitalCV — VitalCV" in the browser tab and in
// every share card. Recorded as finding F8 of the 2026-08-09 page audit.
export const PERSONA_LANDING_PAGES: ReadonlyArray<PersonaLandingContent> = [
  {
    slug: 'cvo',
    intakePersona: 'cvo',
    title: 'For CVOs',
    description:
      'Cut days-to-start without dropping primary-source rigor. VitalCV produces receipt candidates and PSV receipts your reviewers can stand behind.',
    hero: {
      eyebrow: 'For credentialing verification organizations',
      headline:
        'Faster files. Same source rigor. Receipts your reviewers will stand behind.',
      subhead:
        'VitalCV models every issuer response as a receipt candidate, not a verification — so a clinician moves only when a human reviewer accepts the policy decision.',
    },
    valueProps: [
      {
        title: 'Receipt candidates, not silent approvals',
        description:
          'Issuer responses become typed receipt candidates with explicit limitation notes. Nothing is decision-grade until a reviewer accepts it under your policy.',
      },
      {
        title: 'PSV reuse with explicit consent boundaries',
        description:
          'Cross-tenant reuse is blocked unless a consent receipt is on file. Constraint tampering is detected at the database level, not just the UI.',
      },
      {
        title: 'Drop-in next to your existing CVO stack',
        description:
          'API-first, schema-typed, audit-ready. We sit alongside your existing case management; we do not require ripping out a system of record.',
      },
    ],
    flow: [
      {
        step: '01',
        title: 'Issuer request goes out',
        description:
          'Clinician consent + partner route are recorded. The request itself is not a verification.',
      },
      {
        step: '02',
        title: 'Issuer responds',
        description:
          'Response is normalized into a receipt candidate with attribution, source basis, and limitation notes.',
      },
      {
        step: '03',
        title: 'Your reviewer makes the policy call',
        description:
          'Five-gate policy review. Only an accept_candidate decision under ready_for_policy_review can produce a PSV receipt candidate.',
      },
    ],
    cta: {
      headline: 'See it on a real file.',
      body:
        'Ten-minute screen-share, no slide deck. Bring a closed file you would not mind us walking through end to end.',
      button: 'Request a CVO walkthrough',
    },
  },
  {
    slug: 'payer',
    intakePersona: 'payer',
    title: 'For Payers',
    description:
      'Reduce credentialing-cycle drag on network expansion. Receipt candidates are auditable, scoped, and never claim more than the source said.',
    hero: {
      eyebrow: 'For health plans + payers',
      headline:
        'Bring credentialing drag down without inheriting a vendor lock.',
      subhead:
        'VitalCV produces source-attributed receipt candidates that your delegation oversight team can audit. Reuse is scoped, not assumed.',
    },
    valueProps: [
      {
        title: 'Audit trail your delegation oversight already expects',
        description:
          'Every receipt candidate carries the responder, source basis, attribution status, and review state. No black-box scoring.',
      },
      {
        title: 'Network expansion without re-credentialing every clinician',
        description:
          'PSV receipts are scoped artifacts with explicit freshness and supersession. They do not silently expire under your auditor.',
      },
      {
        title: 'No proprietary trust score',
        description:
          'We do not invent a numeric score for credentialing decisions. The decision and its evidence stay separable.',
      },
    ],
    flow: [
      {
        step: '01',
        title: 'Network candidate enters credentialing',
        description:
          'Identity is captured with provenance. Nothing is claimed about source truth at this step.',
      },
      {
        step: '02',
        title: 'Source verification produces receipt candidates',
        description:
          'Each issuer response is a typed candidate. Limitations and unable-to-verify outcomes are first-class, not error states.',
      },
      {
        step: '03',
        title: 'Your committee or delegated reviewer decides',
        description:
          'Policy review under your standards produces the PSV receipt candidate. Promotion to PSV receipt is gated by your scope rules.',
      },
    ],
    cta: {
      headline: 'Bring a delegation oversight question.',
      body:
        'Send us the question your auditor would ask first. We will show you exactly where in the receipt the answer lives.',
      button: 'Request a payer walkthrough',
    },
  },
  {
    slug: 'staffing-exchange',
    intakePersona: 'staffing_exchange',
    title: 'For Staffing Exchanges',
    description:
      'Clinicians arrive with portable, scoped credentialing artifacts. Match faster without re-running primary source for every placement.',
    hero: {
      eyebrow: 'For locum networks + staffing exchanges',
      headline:
        'Clinicians who arrive credentialing-ready — with receipts a hospital can audit.',
      subhead:
        'VitalCV gives your clinicians portable, scoped artifacts. The hospital sees the source, the responder, and the limitation — not a marketing badge.',
    },
    valueProps: [
      {
        title: 'Portable receipt candidates per credential',
        description:
          'A receipt candidate travels with the clinician. The receiving hospital can see the source and the responder, not just a green check.',
      },
      {
        title: 'Reuse scoped to consent and freshness',
        description:
          'Same-tenant reuse is straightforward; cross-tenant reuse requires a consent receipt and is logged. No silent reuse.',
      },
      {
        title: 'Faster placements without claiming finality',
        description:
          'A PSV receipt is scoped evidence. It compresses time to ready without overstating what the hospital is being asked to accept.',
      },
    ],
    flow: [
      {
        step: '01',
        title: 'Clinician onboarded once',
        description:
          'Identity, license, board, malpractice, and education each captured with provenance and consent.',
      },
      {
        step: '02',
        title: 'Receipt candidates accrue per credential',
        description:
          'Each successful issuer response becomes a receipt candidate the clinician carries forward.',
      },
      {
        step: '03',
        title: 'Receiving hospital reviews the scoped receipt',
        description:
          'They see the source, responder, freshness, and limitation. Their committee makes the decision; we do not pretend to make it for them.',
      },
    ],
    cta: {
      headline: 'See a clinician dossier in 10 minutes.',
      body:
        'We will show you a real demo dossier — sources, attribution, limitation notes, and reuse scope, end to end.',
      button: 'Request a staffing walkthrough',
    },
  },
];

export function getPersonaLandingContent(
  slug: string,
): PersonaLandingContent | undefined {
  return PERSONA_LANDING_PAGES.find((p) => p.slug === slug);
}
