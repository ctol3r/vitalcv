import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtifactStage } from '@/components/motion/ArtifactStage';
import { HospitalArtifact } from '@/components/artifacts/SceneArtifacts';
import { EmployerAudienceSection } from '@/components/employers/EmployerAudienceSection';
import { EmployerWorkflowPreview } from '@/components/employers/EmployerWorkflowPreview';
import { PageFrame } from '@/components/layout/PageFrame';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * /employers — the employer landing.
 *
 * Restructured per the founder experience audit (2026-08-06): the page ran
 * 5,744px with its only conversion moment at 96% depth, the primary CTA was a
 * 5,100px in-page smooth-scroll, and three mono disclaimer paragraphs sat
 * between the H1 and the action. The restructure:
 *
 *  - The primary CTA is a real route, `/employers/request-access`, which now
 *    owns Step 1 (the Type 2 NPI resolution + access request). The page sells;
 *    the route converts.
 *  - The lane register and the illustrative packet moved to
 *    `/employers/how-it-works`. This page keeps a short, registry-derived
 *    hand-off so the lane count cannot drift from lane truth.
 *  - The D3 limits block survives, compressed to two sentences plus the
 *    registry-derived cadence line, placed directly after the hero artifact:
 *    still early, still plain prose, no longer outranking the only action.
 *    The audit asked for below-the-fold; D3 (deep-audit 2026-07-21) requires
 *    "early, never a footnote" for procurement readers. This is the
 *    reconciliation — final placement is a founder visual gate decision.
 *
 * REVISION 2 (founder visual gate, 2026-08-07): the restructure was approved;
 * the hierarchy was not. The evidence-led H1 ("Start clinicians from
 * source-backed evidence") sold the trust machinery as the product. The
 * canonical employer direction is the hiring experience — find clinicians,
 * see what is known, watch what remains, move the hire toward start — with
 * attribution entering immediately beneath as the reason the experience can
 * be trusted. Organization access is framed as the doorway in, not the value
 * proposition, and the audience section was recomposed from six cards in two
 * grids to two hairline row lists. No quantitative speed claim anywhere: the
 * brand split (2026-07-26) still bans pace language, and this page describes
 * the work, not the clock.
 *
 * Step 1 remains a REQUEST for organization access, never a claim: resolving a
 * Type 2 NPI against NPPES establishes which organization is meant, not
 * authority to act for it, and the server refuses on that basis
 * (resolveOrganizationAuthority).
 *
 * The outcome is stated WITHOUT a speed claim. The brand split (2026-07-26)
 * retired the speed hero — "faster" is a promise about time-to-start, and no
 * pilot has measured it yet. Re-add it only when a pilot produces the number,
 * and then state the number, not the adjective. See check-public-claims.ts.
 *
 * The cadence sentence derives from lib/trust/sourceLanes.ts, the same
 * registry behind /, /status and /api/status, so this page cannot drift from
 * lane truth.
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Clinician Hire-to-Start Platform for Employers',
  description:
    'VitalCV is the Clinician Hire-to-Start Platform: a joined case from clinician-controlled application to employer-confirmed first day. Your ATS and institutional credentialing authority remain in place.',
};

/** Lane-truth cadences, from the registry — never hand-typed on this page. */
function cadenceSentence(): string {
  const label = (id: string) =>
    SOURCE_LANE_OPS.find((lane) => lane.laneId === id)?.cadenceLabel ?? 'not read';
  return (
    `NPPES is ${label('nppes_identity')} per request; ` +
    `OIG/LEIE is a ${label('oig_exclusions')}; CMS PECOS a ${label('pecos_enrollment')}; ` +
    `state licensure stays ${label('state_license')}.`
  );
}

export default function EmployersPage() {
  return (
    // Calm Wave, employer surface on full-width paper (one editorial accent, CD-3) — the
    // same design language as the homepage, so the acquisition page reads as one
    // system instead of a plainer offshoot.
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame as="main" mode="focused-form">
        <header className="mb-4">
          <p className="mz-eyebrow">For employers &amp; verifiers</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 680 }}>
            Move a clinician hire from interest to <span className="mz-accent">start</span>.
          </h1>
          <p className="mz-lede" style={{ marginTop: 12, maxWidth: 620 }}>
            The clinician arrives with a profile they have already built and reviewed. You see
            what is known, what remains, and who owns the next step — and the hiring decision
            stays yours.
          </p>
          <p className="mz-small" style={{ marginTop: 10, maxWidth: 620 }}>
            VitalCV is the Clinician Hire-to-Start Platform: from opportunity to an
            employer-confirmed first day. Keep your ATS and your credentialing platform;
            VitalCV connects the joined case between them without taking over their authority.
          </p>
          {/* Evidence enters here, immediately under the experience, as the
              reason it can be trusted — not as the proposition itself
              (REVISION 2). */}
          <p className="mz-small" style={{ marginTop: 10, maxWidth: 620 }}>
            What makes that reviewable is attribution: identity, exclusions, and enrollment
            answers arrive named to their public source, dated, with what has not been checked
            listed beside them.
          </p>
          {/* One action in the opening viewport, and it is a real route: the
              page makes the case, /employers/request-access takes the request.
              The caption keeps the mechanism in its place — a doorway, not
              the reason the product exists. */}
          <p style={{ marginTop: 16 }}>
            <Link href="/employers/request-access" className="mz-btn">
              Request organization access
            </Link>
          </p>
          <p className="mz-mono mt-2 text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
            Organization access is the doorway in, not the product — resolve your organization
            against the federal registry and ask to begin.
          </p>
        </header>

        {/* The hero artifact: the employer as somewhere REAL. This page used to
            open on an abstract worklist rectangle, which made the buyer surface
            read like every other B2B diagram. An elevation of the hospital —
            packet arriving at the door, one lit room where it is being read —
            says who the page is for before a word of copy is. */}
        {/* Dense vignette (founder density lever, 2026-08-07): same drawing,
            cropped viewBox and compact stage — the elevation still says who
            the page is for without spending half a viewport saying it. */}
        <section aria-label="Where the packet arrives" className="mt-6">
          <ArtifactStage glass dense>
            <HospitalArtifact />
          </ArtifactStage>
        </section>

        {/* D3: plain, early limits — compressed to the boundary, the cadence,
            and the diligence route. The per-field register link stays INSIDE
            this block (employers-diligence-route contract): the reader with a
            diligence question finds the register beside the boundary, not in
            marketing body copy. */}
        <div
          data-employer-limits=""
          className="mz-mono mt-6 max-w-[620px] border-l-2 border-[var(--vt-border)] pl-3 text-[12px] leading-relaxed text-[var(--vt-text-muted)]"
        >
          <p>
            The limits, stated plainly: VitalCV is not a credentialing service, and each
            institution retains final credentialing, privileging, and hiring authority.{' '}
            {cadenceSentence()}
          </p>
          <p style={{ marginTop: 6 }}>
            Checking us out?{' '}
            <Link
              href="/trust/attribution"
              className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]"
            >
              Read the per-field source register
            </Link>{' '}
            — every field, its source, when we read it, and what it does not establish.
          </p>
        </div>

        {/* The reviewer's-eye artifact ("what a reviewer receives") moved to
            /employers/how-it-works with the rest of the packet anatomy — two
            glass artifact stages in a row competed, and its subject is exactly
            what that page carries in full. */}
        <EmployerWorkflowPreview />

        {/* The lane register and the illustrative packet live on their own page
            now (audit: reference-documentation density on a landing page). The
            hand-off keeps one registry-derived fact — the lane count — so even
            this sentence cannot drift from lane truth. */}
        <section aria-label="What arrives, source by source" className="mt-9">
          <p className="mz-eyebrow">What arrives, source by source</p>
          <h2 className="mz-h2" style={{ marginTop: 8, maxWidth: 620 }}>
            {SOURCE_LANE_OPS.length} evidence lanes, each named to its source.
          </h2>
          <p className="mz-small" style={{ marginTop: 8, maxWidth: 620 }}>
            Every lane states what it returns, when it was read, and what it does not decide —
            read from the same registry that drives /status. The full register, and what a
            reviewed packet looks like, has its own page.
          </p>
          <p style={{ marginTop: 12 }}>
            <Link
              href="/employers/how-it-works"
              className="text-[14px] font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
            >
              See what each lane returns, and what a reviewed packet looks like
            </Link>
          </p>
        </section>

        {/* MB1 — the teams who actually read this page, and the way in by org size.
            Placed after the operating model has made the case and BEFORE the ask,
            which is the order every credentialing vendor uses for its segmented
            story (study §9.4). Small practices and groups route to
            /employers/request-access; health systems route to /pilot. */}
        <EmployerAudienceSection />

        {/* What this costs (founder ruling, 2026-08-07): the audit's
            30-second test asked "what do I pay for?" and this page answered
            with silence, which reads as enterprise-sales friction. Every
            sentence below is checkable today — collectsPayment:false across
            all plans (lib/commercial/pricingFoundation.ts), Stripe dark
            without its key — and the direction sentence is the category
            strategy's own model (docs/strategy/vitalcv-category-strategy.md:
            "Employers should pay for outcomes and workflow"), stated without
            figures because real pricing is set in a signed scope, never on
            a page. */}
        <section aria-label="What this costs" data-employer-pricing="" className="mt-9">
          <p className="mz-eyebrow">What this costs</p>
          <p className="mz-small" style={{ marginTop: 8, maxWidth: 620 }}>
            Free for clinicians, always. For organizations: no payment is collected on this
            site — the pilot costs nothing, and commercial terms are set in a signed scope.
            When VitalCV charges employers, it charges for outcomes — clinicians who start —
            not seats or lookups.{' '}
            <Link
              href="/pricing"
              className="font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
            >
              Plain terms, stated
            </Link>
          </p>
        </section>

        {/* The close: same label, same destination as the hero — one intention,
            one route (audit: three labels for one intention forced a choice
            without information). */}
        <section className="mz-card mt-9 p-5 sm:p-6" aria-label="Request organization access">
          <p className="mz-eyebrow">Ready when you are</p>
          <h2 className="mz-h2" style={{ marginTop: 8 }}>
            Request access to your organization
          </h2>
          <p className="mz-small" style={{ marginTop: 4, marginBottom: 12, maxWidth: 620 }}>
            The doorway into the employer experience: resolve your organization against the
            federal registry and request access — a request that has to be granted, never a
            claim.
          </p>
          <p>
            <Link href="/employers/request-access" className="mz-btn">
              Request organization access
            </Link>
          </p>
        </section>

        <p className="mt-5 text-center text-xs text-[var(--vt-text-muted)]">
          A network or health system?{' '}
          <Link href="/pilot" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Request a pilot
          </Link>{' '}
          · Already set up?{' '}
          <Link href="/employer/dashboard" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Open your workspace
          </Link>
        </p>
      </PageFrame>
    </div>
  );
}
