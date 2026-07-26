import type { Metadata } from 'next';
import Link from 'next/link';
import { EmployerGetStartedClient } from './EmployerGetStartedClient';
import { EmployerPacket } from '@/components/employers/EmployerPacket';
import { EmployerWorkflowPreview } from '@/components/employers/EmployerWorkflowPreview';
import { PageFrame } from '@/components/layout/PageFrame';

/**
 * /employers — the demand-side doorway.
 *
 * This page used to open with "Claim your organization, verify clinicians." and
 * an NPI form. Two things were wrong with that, one of them serious.
 *
 * The ordinary problem: claiming an organization is a PREREQUISITE, not a
 * reason. Leading with it asked a buyer to do setup before being told what the
 * setup was for, and put a disabled button in the first screen where the
 * argument should be. The claim form now appears after the value, framed as
 * what it is — the first step of setup.
 *
 * The serious problem: "verify clinicians" promised the one thing VitalCV
 * must never claim. `/` states plainly that it "does not credential, privilege,
 * or clear anyone — the institution keeps that decision"; this page told the
 * buyer the opposite in its own H1. Two public pages contradicting each other
 * on the central boundary is worse than either page being weak, because the
 * boundary is the product. The promise is now the honest one, which is also the
 * one the buyer actually cares about: they start people sooner.
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'For Employers · VitalCV',
  description:
    'Start clinicians sooner from source-backed evidence they already carry. See a consented packet, the requirements it covers, and the blockers that remain — while your committee keeps every decision that is yours.',
};

export default function EmployersPage() {
  return (
    // Calm Wave, employer persona (source-green accent) on full-width paper —
    // the same design language as the homepage, so the acquisition page reads
    // as one system instead of a plainer offshoot.
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame as="main" mode="marketing">
        {/* The argument and the artifact share the first screen: what you get,
            beside the thing you get. Same lesson as the homepage — a claim
            without the object next to it reads as a brochure. */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <header>
            <p className="mz-eyebrow">For employers &amp; verifiers</p>
            <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 620 }}>
              Start clinicians <span className="mz-accent">sooner</span>.
            </h1>
            <p className="mz-lede" style={{ marginTop: 14, maxWidth: 560 }}>
              A qualified clinician spends weeks re-proving the same six things to every employer
              who asks. When they arrive with that evidence already assembled and consented, your
              review starts from what is known instead of from an empty folder.
            </p>
            <p className="mz-small" style={{ marginTop: 14, maxWidth: 560 }}>
              You keep the decision. VitalCV assembles what the sources return and shows you what is
              covered, what is gated, and what is still open — it does not credential, privilege, or
              clear anyone.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="#claim"
                className="inline-flex items-center rounded-[3px] bg-[var(--vt-text-primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--vt-bg)] transition-opacity hover:opacity-90"
              >
                Claim your organization
              </Link>
              <Link
                href="/pilot"
                className="text-[13px] underline underline-offset-4 text-[var(--vt-text-secondary)] hover:text-[var(--vt-text-primary)]"
              >
                Run a scoped pilot
              </Link>
            </div>
          </header>

          <EmployerPacket />
        </div>

        <EmployerWorkflowPreview />

        {/* Setup, after the reason for it. */}
        <section
          id="claim"
          className="mz-card mt-12 scroll-mt-24 p-5 sm:p-6"
          aria-label="Claim your organization"
        >
          <p className="mz-eyebrow">First step</p>
          <h2 className="mz-h2" style={{ marginTop: 8 }}>
            Claim your organization
          </h2>
          <p className="mz-small" style={{ marginTop: 6, marginBottom: 16, maxWidth: 560 }}>
            Your organization has a Type 2 NPI in the same federal registry a clinician uses. Enter
            it and confirm it — the same 30-second flow, resolved against NPPES. This establishes
            which organization you are; it is not legal proof of authority over it.
          </p>
          <EmployerGetStartedClient />
        </section>

        <p className="mt-6 text-center text-xs text-[var(--vt-text-muted)]">
          A network or health system?{' '}
          <Link href="/pilot" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Request a pilot
          </Link>{' '}
          · Already set up?{' '}
          <Link
            href="/employer/dashboard"
            className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]"
          >
            Open your workspace
          </Link>
        </p>
      </PageFrame>
    </div>
  );
}
