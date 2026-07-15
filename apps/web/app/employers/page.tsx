import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, FileCheck2, Clock } from 'lucide-react';
import { EmployerGetStartedClient } from './EmployerGetStartedClient';
import { Reveal } from '@/components/motion/Reveal';

/**
 * /employers — the employer landing + onboarding.
 *
 * Previously a bare redirect to /pilot (a rescue for a broken directory). Now a
 * real page: employers verify ownership of their organization as simply as a
 * clinician verifies their NPI — enter your organization's Type 2 NPI, confirm
 * it against NPPES, and claim it. (Enterprise/network buyers can still request a
 * pilot below.)
 */

export const metadata: Metadata = {
  title: 'For Employers · VitalCV',
  description:
    "Claim your organization's Type 2 NPI and start reviewing source-backed clinician passports — onboarding as simple as the clinician sign-up.",
};

const VALUE_PROPS = [
  {
    icon: FileCheck2,
    title: 'Start from a proof packet',
    body: 'Review a source-backed readiness snapshot, not a stack of scattered documents.',
  },
  {
    icon: ShieldCheck,
    title: 'Accept as a head start',
    body: 'Take a clinician’s snapshot as a head start. Your credentialing committee keeps the decision.',
  },
  {
    icon: Clock,
    title: 'Start clinicians sooner',
    body: 'See source coverage, freshness, and blockers up front — shorten time-to-start.',
  },
];

export default function EmployersPage() {
  return (
    // Calm Wave, employer persona (source-green accent) on full-width paper — the
    // same design language as the homepage, so the acquisition page reads as one
    // system instead of a plainer offshoot.
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <header className="mb-8">
          <p className="mz-eyebrow">For employers &amp; verifiers</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 640 }}>
            Claim your organization, <span className="mz-accent">verify clinicians</span>.
          </h1>
          <p className="mz-lede" style={{ marginTop: 12, maxWidth: 560 }}>
            Onboarding is as simple as a clinician&rsquo;s. Your organization has a Type 2 NPI in the same federal
            registry — enter it, confirm it, and claim your employer workspace.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {VALUE_PROPS.map((v, i) => (
            <Reveal
              key={v.title}
              delay={i * 80}
              className="mz-interactive flex flex-col gap-2 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4"
            >
              <span
                aria-hidden="true"
                className="mz-pop flex h-9 w-9 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-accent-emerald)]"
              >
                <v.icon className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">{v.title}</h2>
              <p className="text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">{v.body}</p>
            </Reveal>
          ))}
        </div>

        <section className="mz-card mt-8 p-5 sm:p-6" aria-label="Claim your organization">
          <h2 className="mz-h2">Enter your organization&rsquo;s NPI</h2>
          <p className="mz-small" style={{ marginTop: 4, marginBottom: 16 }}>
            The same 30-second flow a clinician uses — resolved against NPPES, the federal source of record.
          </p>
          <EmployerGetStartedClient />
        </section>

        <p className="mt-6 text-center text-xs text-[var(--vt-text-muted)]">
          A network or health system?{' '}
          <Link href="/pilot" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Request a pilot
          </Link>{' '}
          · Already set up?{' '}
          <Link href="/verifier" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Open your workspace
          </Link>
        </p>
      </main>
    </div>
  );
}
