import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, FileCheck2, Clock } from 'lucide-react';
import { EmployerGetStartedClient } from './EmployerGetStartedClient';

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
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          For employers &amp; verifiers
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Claim your organization, verify clinicians.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Onboarding is as simple as a clinician&rsquo;s. Your organization has a Type 2 NPI in the same federal
          registry — enter it, confirm it, and claim your employer workspace.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {VALUE_PROPS.map((v) => (
          <div key={v.title} className="rounded-xl border border-border bg-card p-4">
            <v.icon className="h-4 w-4 text-[var(--vt-state-verified,#1c7c54)]" aria-hidden="true" />
            <h2 className="mt-2 text-sm font-semibold leading-snug text-foreground">{v.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{v.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6" aria-label="Claim your organization">
        <h2 className="text-base font-semibold">Enter your organization&rsquo;s NPI</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          The same 30-second flow a clinician uses — resolved against NPPES, the federal source of record.
        </p>
        <EmployerGetStartedClient />
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        A network or health system?{' '}
        <Link href="/pilot" className="underline underline-offset-2 hover:text-foreground">
          Request a pilot
        </Link>{' '}
        · Already set up?{' '}
        <Link href="/verifier" className="underline underline-offset-2 hover:text-foreground">
          Open your workspace
        </Link>
      </p>
    </main>
  );
}
