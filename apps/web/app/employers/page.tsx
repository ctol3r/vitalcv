import type { Metadata } from 'next';
import Link from 'next/link';
import { EmployerGetStartedClient } from './EmployerGetStartedClient';
import { EmployerAudienceSection } from '@/components/employers/EmployerAudienceSection';
import { EmployerWorkflowPreview } from '@/components/employers/EmployerWorkflowPreview';
import { PageFrame } from '@/components/layout/PageFrame';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * /employers — the employer landing + onboarding.
 *
 * Wave 6 (deep-audit 2026-07-21) + D3 (one-platform synthesis): the doorway
 * leads with the BUYER OUTCOME — "Start clinicians faster from source-backed
 * evidence" — not with setup mechanics. The Type 2 NPI claim is real and
 * necessary, but it is Step 1 of the workflow, so it renders after the buyer
 * has seen the job-to-start operating model, not as the page's thesis.
 *
 * D3 (high-effort readers): limits are stated plainly and EARLY on this
 * surface — the blemishing effect that lets the clinician film defer limits
 * does not apply to procurement readers. The cadence sentence derives from
 * lib/trust/sourceLanes.ts, the same registry behind /, /status and
 * /api/status, so this page cannot drift from lane truth.
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'For Employers · VitalCV',
  description:
    'Start clinicians faster from source-backed evidence — review consented, attributable packets, see remaining requirements up front, and keep the final decision. Claim your organization’s Type 2 NPI to begin.',
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
    // Calm Wave, employer persona (source-green accent) on full-width paper — the
    // same design language as the homepage, so the acquisition page reads as one
    // system instead of a plainer offshoot.
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame as="main" mode="focused-form">
        <header className="mb-5">
          <p className="mz-eyebrow">For employers &amp; verifiers</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 680 }}>
            Start clinicians faster from <span className="mz-accent">source-backed evidence</span>.
          </h1>
          <p className="mz-lede" style={{ marginTop: 12, maxWidth: 620 }}>
            A clinician arrives with a consented, attributable evidence packet — identity,
            exclusions, enrollment, each answer named to its source. You see requirements and
            remaining blockers up front, instead of opening another document chase.
          </p>
          {/* D3: plain, early limits — visible prose in the opening viewport,
              never a footnote. Boundary first, cadence second. */}
          <div
            data-employer-limits=""
            className="mz-mono mt-4 max-w-[620px] border-l-2 border-[var(--vt-border)] pl-3 text-[12px] leading-relaxed text-[var(--vt-text-muted)]"
          >
            <p>
              The limits, stated plainly: VitalCV is not a credentialing service. Head-start
              acceptance is not a credentialing decision, and the hiring decision stays yours.
            </p>
            <p style={{ marginTop: 6 }}>{cadenceSentence()}</p>
            {/* Diligence route. The per-field register at /trust/attribution is the
                honest substitute for the compliance badges this market runs on and
                our truth contract forbids — it opens by disclaiming HIPAA, SOC 2 and
                NCQA certification, then names the source, read time and state of
                every field. It was reachable from the clinician homepage but not
                from the procurement surface, which is where the reader with a
                diligence question actually lands. */}
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
          {/* The opening viewport keeps one honest action. It ASKS for nothing —
              it jumps to Step 1 below, after the operating model has made the
              case. Returning buyers skip straight to the claim flow. */}
          <p style={{ marginTop: 20 }}>
            <a href="#claim-your-organization" className="mz-btn">
              Claim your organization
            </a>
          </p>
        </header>

        <EmployerWorkflowPreview />

        {/* MB1 — the teams who actually read this page, and the way in by org size.
            Placed after the operating model has made the case and BEFORE the ask,
            which is the order every credentialing vendor uses for its segmented
            story (study §9.4). Small practices and groups route down to Step 1;
            health systems route to /pilot. */}
        <EmployerAudienceSection />

        <section
          id="claim-your-organization"
          className="mz-card mt-10 scroll-mt-24 p-5 sm:p-6"
          aria-label="Step 1 — claim your organization"
        >
          <p className="mz-eyebrow">Step 1 — Claim your organization</p>
          <h2 className="mz-h2" style={{ marginTop: 8 }}>
            Enter your organization&rsquo;s NPI
          </h2>
          <p className="mz-small" style={{ marginTop: 4, marginBottom: 16 }}>
            The same 30-second flow a clinician uses — your organization has a Type 2 NPI in the
            same federal registry, resolved against NPPES, the federal source of record.
          </p>
          <EmployerGetStartedClient />
        </section>

        <p className="mt-6 text-center text-xs text-[var(--vt-text-muted)]">
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
