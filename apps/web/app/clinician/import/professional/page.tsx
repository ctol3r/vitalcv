import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildProfessionalImportFoundationEntries,
  explainProfessionalImportStatus,
  PROFESSIONAL_IMPORT_DISCLAIMERS,
  type ProfessionalImportEntry,
} from '@/lib/import-export/professionalImportFoundation';

export const metadata: Metadata = {
  title: 'Professional Import · VitalCV',
  description:
    'LinkedIn and Doximity imports are planned entry points, not live integrations. PubMed entries are publication candidates until source-backed matching is attached. No scraping or credential collection is performed.',
};

const STATUS_CLASS: Record<ProfessionalImportEntry['status'], string> = {
  planned: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  entry_only: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  candidate_ready: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  source_candidate: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  source_backed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  unavailable: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  blocked: 'border-red-500/40 bg-red-500/10 text-red-600',
};

export default function ClinicianProfessionalImportPage() {
  const entries = buildProfessionalImportFoundationEntries();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Professional import
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          LinkedIn, Doximity, PubMed, CV, and roster sources
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`LinkedIn and Doximity imports are planned entry points, not live integrations.`}</strong>{' '}
          <strong>{`PubMed entries are publication candidates until source-backed matching is attached.`}</strong>{' '}
          <strong>{`No scraping or credential collection is performed.`}</strong>
        </p>
      </header>

      <section
        aria-labelledby="entries-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="entries-heading" className="text-base font-semibold sm:text-lg">
          Import entries
        </h2>
        <ul className="mt-3 space-y-3">
          {entries.map((entry) => (
            <li key={entry.kind} className="text-sm">
              <p className="font-medium">
                {entry.label}{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[entry.status]}`}
                  aria-label={`Status: ${entry.status}`}
                  title={explainProfessionalImportStatus(entry.status)}
                >
                  {entry.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">Roadmap: {entry.roadmapNote}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="disclaimers-heading" className="text-sm font-semibold">
          Disclaimers
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {PROFESSIONAL_IMPORT_DISCLAIMERS.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
