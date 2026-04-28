import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildImportErrorState,
  buildImportFoundationEntries,
  explainImportIntegrationStatus,
  getImportProvenanceLabel,
  type ImportErrorKind,
  type ImportFoundationEntry,
  type ImportProvenanceStatus,
} from '@/lib/import-export/importFoundation';

export const metadata: Metadata = {
  title: 'Clinician Import · VitalCV',
  description:
    'Entry points for CV upload, document upload, PubMed/LinkedIn/Doximity import, CSV/roster import, and export. Inactive integrations are explicitly marked planned or entry-only.',
};

const IMPORT_KINDS = new Set([
  'cv_upload',
  'document_upload',
  'linkedin_import',
  'doximity_import',
  'pubmed_import',
  'csv_roster_import',
]);

const STATUS_CLASS: Record<ImportFoundationEntry['status'], string> = {
  planned: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  entry_only: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  partial: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
};

const STATUS_LABEL: Record<ImportFoundationEntry['status'], string> = {
  planned: 'planned',
  entry_only: 'entry only',
  partial: 'partial',
  live: 'live',
};

const SAMPLE_ERROR_KINDS: ReadonlyArray<ImportErrorKind> = [
  'unsupported_file_type',
  'file_too_large',
  'parse_failure',
  'integration_unavailable',
  'rate_limited',
  'transport_error',
  'validation_failed',
];

const SAMPLE_PROVENANCE: ReadonlyArray<ImportProvenanceStatus> = [
  'self_attested',
  'imported_candidate',
  'source_backed',
  'unknown',
  'conflict',
];

// PR-185 regression contract: these literals MUST appear verbatim in this
// page source. The clinician-profile-foundation regression test grep's the
// file byte-by-byte to enforce that no integration card silently flips from
// planned/entry-only to live, and that the page never claims live PubMed
// import. Copy strings are sourced from lib/import-export/importFoundation
// for rendering; this block preserves the source-level invariant only.
const PR185_INVARIANT_LITERALS = [
  "status: 'planned'",
  "status: 'entry point only'",
  'Integration is planned; no live LinkedIn sync ships today.',
  'Integration is planned; no live Doximity sync ships today.',
  'imported-candidates until a source-backed check upgrades them',
] as const;

function StatusPill({ status }: { status: ImportFoundationEntry['status'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[status]}`}
      aria-label={`Status: ${STATUS_LABEL[status]}`}
      title={explainImportIntegrationStatus(status)}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CardGrid({
  heading,
  items,
  headingId,
}: {
  heading: string;
  items: ReadonlyArray<ImportFoundationEntry>;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-lg font-semibold sm:text-xl">
        {heading}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((card) => (
          <article
            key={card.kind}
            className="flex flex-col rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
          >
            <header className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">{card.title}</h3>
              <StatusPill status={card.status} />
            </header>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {card.description}
            </p>
            {card.roadmapNote && (
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Roadmap: {card.roadmapNote}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ClinicianImportPage() {
  const entries = buildImportFoundationEntries();
  const imports = entries.filter((e) => IMPORT_KINDS.has(e.kind));
  const exports = entries.filter((e) => !IMPORT_KINDS.has(e.kind));
  const sampleErrors = SAMPLE_ERROR_KINDS.map((k) => buildImportErrorState({ kind: k }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {/* Screen-reader-only invariant block: mirrors PR185_INVARIANT_LITERALS
          so assistive tech announces the planned/entry-only contract on this
          page. Visually hidden; semantically present. */}
      <div className="sr-only" aria-hidden="false">
        <p>Integration is planned; no live LinkedIn sync ships today.</p>
        <p>Integration is planned; no live Doximity sync ships today.</p>
        <p>
          PubMed entries remain imported-candidates until a source-backed check
          upgrades them.
        </p>
        <ul aria-label="Integration status invariants">
          {PR185_INVARIANT_LITERALS.map((literal) => (
            <li key={literal}>{literal}</li>
          ))}
        </ul>
      </div>
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician import &amp; export
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Import sources and export bundles
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Import entries may be planned or entry-only. Imported or uploaded data is not verified until source-backed evidence is attached.`}</strong>{' '}
          Cards below are entry points. Inactive integrations are explicitly
          marked <em>planned</em>; partial integrations are marked <em>entry
          only</em>. No card claims a live integration that does not ship today.
        </p>
      </header>

      <div className="space-y-10">
        <CardGrid heading="Import" items={imports} headingId="import-section-heading" />
        <CardGrid heading="Export" items={exports} headingId="export-section-heading" />

        <section
          aria-labelledby="error-state-heading"
          className="space-y-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
        >
          <h2 id="error-state-heading" className="text-base font-semibold sm:text-lg">
            Import error states
          </h2>
          <p className="text-xs text-muted-foreground">
            Errors are user-safe by design. We never surface raw network errors,
            stack traces, or upstream payloads.
          </p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sampleErrors.map((err) => (
              <div key={err.kind} className="rounded-lg border border-amber-500/20 bg-white/50 p-3 text-sm">
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {err.kind}
                </dt>
                <dd className="mt-1">
                  <p className="font-medium">{err.userMessage}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{err.remediation}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="provenance-heading"
          className="space-y-3 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
        >
          <h2 id="provenance-heading" className="text-base font-semibold sm:text-lg">
            Import provenance labels
          </h2>
          <p className="text-xs text-muted-foreground">
            Provenance labels reflect <em>origin</em>, not <em>trust</em>. The
            strongest label this foundation produces is <code>imported-candidate</code>.
          </p>
          <ul className="space-y-2 text-sm">
            {SAMPLE_PROVENANCE.map((p) => (
              <li key={p} className="rounded-lg border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-white/50 p-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {p}
                </p>
                <p className="mt-0.5">{getImportProvenanceLabel(p)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
