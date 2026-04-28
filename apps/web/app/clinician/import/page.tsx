import * as React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clinician Import · VitalCV',
  description:
    'Entry points for CV upload, document upload, PubMed/LinkedIn/Doximity import, CSV/roster import, and export. Inactive integrations are explicitly marked planned or entry-point-only.',
};

type IntegrationStatus = 'planned' | 'entry point only';

interface IntegrationCard {
  key: string;
  title: string;
  body: string;
  status: IntegrationStatus;
}

const IMPORTS: ReadonlyArray<IntegrationCard> = [
  {
    key: 'cv-upload',
    title: 'CV upload',
    body: 'Upload a CV/resume. Document parsing into structured profile fields is not wired in this entry point.',
    status: 'entry point only',
  },
  {
    key: 'document-upload',
    title: 'Document upload',
    body: 'Attach a credentialing document (license, certificate, attestation). Source-backed verification of the document is a separate path.',
    status: 'entry point only',
  },
  {
    key: 'pubmed',
    title: 'PubMed import',
    body: 'Pull authored publications from PubMed. Imported entries are imported-candidates until a source-backed check upgrades them.',
    status: 'entry point only',
  },
  {
    key: 'linkedin',
    title: 'LinkedIn import',
    body: 'Pull employment and education from LinkedIn. Integration is planned; no live LinkedIn sync ships today.',
    status: 'planned',
  },
  {
    key: 'doximity',
    title: 'Doximity import',
    body: 'Pull profile content from Doximity. Integration is planned; no live Doximity sync ships today.',
    status: 'planned',
  },
  {
    key: 'csv-roster',
    title: 'CSV / roster import',
    body: 'Bulk-import a roster of clinicians. Some CSV ingest paths exist for pilot ops; full roster automation is planned.',
    status: 'entry point only',
  },
];

const EXPORTS: ReadonlyArray<IntegrationCard> = [
  {
    key: 'export-bundle',
    title: 'Export bundle',
    body: 'Export an audit-ready bundle of your filled fields and any attached evidence. Bundle UX is in progress; cryptographic signing of exports is planned.',
    status: 'entry point only',
  },
  {
    key: 'shareable-passport',
    title: 'Shareable passport',
    body: 'Generate a public/limited-share passport URL for your profile. Provenance badges accompany every field on the share view.',
    status: 'entry point only',
  },
];

const STATUS_CLASS: Record<IntegrationStatus, string> = {
  planned: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  'entry point only': 'border-amber-500/40 bg-amber-500/10 text-amber-700',
};

function StatusPill({ status }: { status: IntegrationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[status]}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

function CardGrid({ heading, items, headingId }: { heading: string; items: ReadonlyArray<IntegrationCard>; headingId: string }) {
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-lg font-semibold sm:text-xl">
        {heading}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((card) => (
          <article
            key={card.key}
            className="flex flex-col rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
          >
            <header className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">{card.title}</h3>
              <StatusPill status={card.status} />
            </header>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ClinicianImportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician import &amp; export
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Import sources and export bundles
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Cards below are entry points. Inactive integrations are explicitly
          marked <em>planned</em>; partial integrations are marked <em>entry
          point only</em>. No card claims a live integration that does not
          ship today. <strong>Imported entries remain imported-candidates
          until a source-backed check upgrades them.</strong>
        </p>
      </header>

      <div className="space-y-10">
        <CardGrid heading="Import" items={IMPORTS} headingId="import-section-heading" />
        <CardGrid heading="Export" items={EXPORTS} headingId="export-section-heading" />
      </div>
    </main>
  );
}
