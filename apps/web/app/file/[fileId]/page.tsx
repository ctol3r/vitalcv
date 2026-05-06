import * as React from 'react';
import type { Metadata } from 'next';

import {
  FILE_TOC,
  buildFileMeta,
  sectionAnchorId,
  type FileSectionId,
} from '@/lib/file/fileMeta';
import { FileTocSidebar } from './FileTocSidebar';

export const metadata: Metadata = {
  title: 'Credentialing File · Demo · VitalCV',
  description:
    'Demo render of a credentialing file packet. Not a real credentialing file.',
};

interface PageProps {
  params: Promise<{ fileId: string }>;
}

export default async function CredentialingFilePage({ params }: PageProps) {
  const { fileId } = await params;
  const meta = buildFileMeta(fileId);

  return (
    <main
      className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="credentialing-file-page"
      data-file-id={meta.id}
      data-file-version={String(meta.version)}
      data-is-demo={String(meta.isDemo)}
    >
      <FileToolbar meta={meta} />

      <p
        className="mt-4 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800"
        data-testid="file-demo-banner"
      >
        Demo file — not a real credentialing record
      </p>

      <div className="mt-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-[72px] lg:self-start">
          <FileTocSidebar fileMetaId={meta.id} />
        </aside>

        <div className="col-span-12 lg:col-span-9 space-y-6">
          {FILE_TOC.map((entry) => (
            <FileSection
              key={entry.id}
              id={entry.id}
              n={entry.n}
              label={entry.label}
              pages={entry.pages}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function FileToolbar({ meta }: { meta: ReturnType<typeof buildFileMeta> }) {
  return (
    <div
      className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
      data-testid="file-toolbar"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Credentialing File
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] font-mono tabular-nums text-foreground truncate">
            {meta.id}
          </span>
          <span className="text-[10.5px] font-mono text-muted-foreground/70">
            v{meta.version}
          </span>
          <span
            className="hidden md:inline-flex text-[9.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground border border-border rounded px-1.5 py-[2px] whitespace-nowrap"
            data-testid="file-classification"
          >
            {meta.classification}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            disabled
            title="Bundle export — Phase 2"
            className="text-[11px] font-mono uppercase tracking-[0.1em] border border-border rounded px-2.5 py-1.5 opacity-50 cursor-not-allowed"
            data-testid="file-bundle-button"
            data-disabled-reason="phase-2-pending"
          >
            Bundle
          </button>
          <button
            type="button"
            disabled
            title="Print export — Phase 2"
            className="text-[11px] font-mono uppercase tracking-[0.1em] border border-foreground bg-foreground text-background rounded px-2.5 py-1.5 opacity-50 cursor-not-allowed"
            data-testid="file-print-button"
            data-disabled-reason="phase-2-pending"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

interface FileSectionProps {
  id: FileSectionId;
  n: string;
  label: string;
  pages: string;
}

function FileSection({ id, n, label, pages }: FileSectionProps) {
  return (
    <section
      id={sectionAnchorId(id)}
      className="rounded-md border border-border bg-card p-5"
      aria-labelledby={`${sectionAnchorId(id)}-heading`}
      data-section-id={id}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3 border-b border-border/50 pb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {n}
          </span>
          <h2
            id={`${sectionAnchorId(id)}-heading`}
            className="text-base font-semibold text-foreground"
          >
            {label}
          </h2>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60">
          p. {pages}
        </span>
      </header>
      <p className="text-xs text-muted-foreground">
        {SECTION_PLACEHOLDER[id]}
      </p>
    </section>
  );
}

const SECTION_PLACEHOLDER: Record<FileSectionId, string> = {
  cover:
    'Cover sheet — file identity, custodian, classification, opened/last-revised dates. Phase 1 surfaces the metadata in the toolbar above.',
  applicant:
    'Applicant identification — clinician identity fields with provenance and confidence. Pulled from the live profile in a later phase.',
  readiness:
    'Readiness & trust summary — derived gate state from the lane health badges. Wired to the issuer-verification chain in a later phase.',
  psv:
    'Primary-Source Verifications — list of ReceiptCandidate rows from the issuer-verification chain (PR #221/#253). decisionGrade is the literal false on each candidate. Populated in a later phase.',
  attestation:
    'Attestation & authorization — clinician self-attestation questionnaire (NCQA CR §3 / TJC MS.06.01.03). Renders in a later phase.',
  missing:
    'Outstanding items — list of incomplete fields with owner and due date. Driven by the gap calculator in a later phase.',
  chain:
    'Chain of custody · audit log — append-only file-event log. Wired to the audit persistence boundary (#175) in a later phase.',
  seal:
    'Signatures & seals — cryptographic seals from the ES256 issuer (#203/#204). Renders in a later phase.',
};
