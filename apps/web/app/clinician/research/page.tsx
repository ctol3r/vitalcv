import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildResearchProfileFoundation,
  buildSamplePublicationCandidates,
  explainPublicationCandidateStatus,
  getResearchProfileReadiness,
} from '@/lib/research/publicationFoundation';

export const metadata: Metadata = {
  title: 'Clinician Research · VitalCV',
  description:
    'Research and publication foundation. PubMed entries are publication candidates until source-backed matching is attached.',
};

export default function ClinicianResearchPage() {
  const foundation = buildResearchProfileFoundation();
  const candidates = buildSamplePublicationCandidates();
  const readiness = getResearchProfileReadiness(candidates);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Research &amp; publications
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Publication candidates &amp; sources
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`PubMed entries are publication candidates until source-backed matching is attached.`}</strong>{' '}
          Author / NPI / person disambiguation is required before any &quot;yours&quot; claim can be made.
          Manual entries are user-entered until a source-backed check upgrades them.
        </p>
      </header>

      <section
        aria-labelledby="readiness-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="readiness-heading" className="text-base font-semibold sm:text-lg">
          Foundation readiness
        </h2>
        <p className="mt-2 text-sm">{readiness.summary}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">Candidates</dt>
            <dd className="mt-1 font-mono">{readiness.candidateCount}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">Match pending review</dt>
            <dd className="mt-1 font-mono">{readiness.matchedPendingReviewCount}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">User-entered</dt>
            <dd className="mt-1 font-mono">{readiness.userEnteredCount}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">Verified</dt>
            <dd className="mt-1 font-mono text-muted-foreground">0 (none — verification is a separate wave)</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="candidates-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="candidates-heading" className="text-base font-semibold sm:text-lg">
          Sample candidates
        </h2>
        <ul className="mt-3 space-y-3">
          {candidates.map((c) => (
            <li key={c.id} className="text-sm">
              <p className="font-medium">
                {c.title}{' '}
                <span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600">
                  {c.source}
                </span>
                {c.year !== null && (
                  <span className="ml-1 text-[10px] text-muted-foreground/70">{c.year}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Status: <strong>{c.status.replace(/_/g, ' ')}</strong> · {explainPublicationCandidateStatus(c.status)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="sources-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="sources-heading" className="text-base font-semibold sm:text-lg">
          Supported source kinds (none live today)
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {foundation.supportedSources.map((s) => (
            <li key={s} className="rounded-full border border-slate-400/40 bg-slate-500/10 px-2 py-0.5 text-slate-600">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="disclaimers-heading" className="text-sm font-semibold">Disclaimers</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {foundation.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
