import type { Metadata } from 'next';
import Link from 'next/link';
import { EmployerGetStartedClient } from './EmployerGetStartedClient';
import { EmployerWorkflowPreview } from '@/components/employers/EmployerWorkflowPreview';
import { PageFrame } from '@/components/layout/PageFrame';

/**
 * /employers — the employer landing + onboarding.
 *
 * Previously a bare redirect to /pilot (a rescue for a broken directory). Now a
 * real page: employers verify ownership of their organization as simply as a
 * clinician verifies their NPI — enter your organization's Type 2 NPI, confirm
 * it against NPPES, and claim it. (Enterprise/network buyers can still request a
 * pilot below.)
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'For Employers · VitalCV',
  description:
    "Claim your organization's Type 2 NPI and start reviewing source-backed clinician passports — onboarding as simple as the clinician sign-up.",
};

export default function EmployersPage() {
  return (
    // Calm Wave, employer persona (source-green accent) on full-width paper — the
    // same design language as the homepage, so the acquisition page reads as one
    // system instead of a plainer offshoot.
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame as="main" mode="focused-form">
        <header className="mb-5">
          <p className="mz-eyebrow">For employers &amp; verifiers</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 640 }}>
            Claim your organization, <span className="mz-accent">verify clinicians</span>.
          </h1>
          <p className="mz-lede" style={{ marginTop: 12, maxWidth: 560 }}>
            Onboarding is as simple as a clinician&rsquo;s. Your organization has a Type 2 NPI in the same federal
            registry — enter it, confirm it, and claim your employer workspace.
          </p>
        </header>

        <section className="mz-card p-5 sm:p-6" aria-label="Claim your organization">
          <h2 className="mz-h2">Enter your organization&rsquo;s NPI</h2>
          <p className="mz-small" style={{ marginTop: 4, marginBottom: 16 }}>
            The same 30-second flow a clinician uses — resolved against NPPES, the federal source of record.
          </p>
          <EmployerGetStartedClient />
        </section>

        <EmployerWorkflowPreview />

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
