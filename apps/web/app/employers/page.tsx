import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, ShieldCheck, FileText } from 'lucide-react';
import { fetchLaunchEmployers } from '@/lib/launch/marketplace';

export const metadata: Metadata = {
  title: 'For Employers',
  description: 'Make hiring decisions faster with source-backed clinician readiness packets.',
  openGraph: {
    title: 'For Employers',
    description: 'Make hiring decisions faster with source-backed clinician readiness packets.',
    url: 'https://vitalcv.com/employers',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'For Employers',
    description: 'Make hiring decisions faster with source-backed clinician readiness packets.',
  },
  alternates: { canonical: 'https://vitalcv.com/employers' },
};

export default async function EmployersPage() {
  const { employers, total } = await fetchLaunchEmployers();

  const hasData = employers.length > 0;
  const directoryListed = hasData ? String(total) : '—';
  const proofBacked = hasData
    ? String(employers.filter((e) => e.verified).length)
    : '—';
  const uniqueStates = hasData
    ? String(new Set(employers.flatMap((e) => e.states)).size)
    : '—';
  const employersShown = hasData ? String(employers.length) : '—';

  return (
    <article className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-24 sm:px-12 lg:px-24 bg-background">
      <header className="mb-12 max-w-2xl">
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--vt-text-3)] mb-4">
          For Employers
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--vt-text-1)] sm:text-5xl leading-tight mb-6">
          Decision before data.
        </h1>
        <p className="text-lg leading-relaxed text-[var(--vt-text-2)]">
          Stop chasing missing documents. Review a source-backed decision posture and accept candidates safely, reducing time-to-start from months to days.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-16">
        {([
          { label: 'Employers shown', value: employersShown, detail: 'Currently listed in this view' },
          { label: 'Directory-listed organizations', value: directoryListed, detail: 'Total live directory entries' },
          { label: 'Proof-backed profiles', value: proofBacked, detail: 'Verified employer profiles' },
          { label: 'Coverage (states)', value: uniqueStates, detail: 'U.S. states with listed employers' },
        ] as const).map(({ label, value, detail }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--vt-text-1)]">{value}</p>
            <p className="mt-1 text-xs text-[var(--vt-text-2)]">{detail}</p>
          </div>
        ))}
      </div>

      <h2 className="sr-only">Platform capabilities</h2>
      <div className="grid gap-12 md:grid-cols-3 mb-24">
        <div className="space-y-4">
          <Clock className="h-6 w-6 text-[var(--vt-text-3)]" />
          <h3 className="text-base font-semibold text-[var(--vt-text-1)]">Shorter Time-to-Start</h3>
          <p className="text-sm text-[var(--vt-text-2)] leading-relaxed">
            Eliminate back-and-forth by starting with a readiness snapshot. Know immediately what is checked, what is missing, and what blocks the start date.
          </p>
        </div>
        <div className="space-y-4">
          <ShieldCheck className="h-6 w-6 text-[var(--vt-text-3)]" />
          <h3 className="text-base font-semibold text-[var(--vt-text-1)]">Honest Source Coverage</h3>
          <p className="text-sm text-[var(--vt-text-2)] leading-relaxed">
            No UI theater. Every claim maps to a real source, receipt, freshness window, and observed timestamp. If it's gated, we say it's gated.
          </p>
        </div>
        <div className="space-y-4">
          <FileText className="h-6 w-6 text-[var(--vt-text-3)]" />
          <h3 className="text-base font-semibold text-[var(--vt-text-1)]">Inspectable Packets</h3>
          <p className="text-sm text-[var(--vt-text-2)] leading-relaxed">
            View clear decision postures (READY, PARTIAL, BLOCKED) and take persisted actions: Accept as head start, Request refresh, or Route to review.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-8 max-w-2xl">
        <h2 className="text-xl font-semibold text-[var(--vt-text-1)] mb-4">
          See the Employer Review Surface
        </h2>
        <p className="text-sm text-[var(--vt-text-2)] mb-8">
          The employer review console is the center of the VitalCV product. Experience the decision flow exactly as your recruiting and credentialing teams would.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/review"
            className="inline-flex justify-center items-center gap-2 rounded-lg bg-[var(--vt-text-1)] px-6 py-3 text-sm font-semibold text-[var(--vt-bg)] transition hover:opacity-90"
          >
            Open Review Console
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/passport"
            className="inline-flex justify-center items-center gap-2 rounded-lg border border-[var(--vt-border)] bg-transparent px-6 py-3 text-sm font-semibold text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
          >
            Start with NPI Lookup
          </Link>
        </div>
      </div>
    </article>
  );
}
