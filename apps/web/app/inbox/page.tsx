import * as React from 'react';
import type { Metadata } from 'next';

import {
  DOC_CLASS_META,
  INBOX_PROVENANCE_META,
  computeInboxStats,
  demoInbox,
  formatBytes,
  type InboxDocument,
  type InboxExtractedField,
  type InboxProvenance,
  type InboxState,
  type InboxSuggestion,
} from '@/lib/inbox/inboxData';

export const metadata: Metadata = {
  title: 'AI Knowledge Inbox · Demo · VitalCV',
  description:
    'Demo render of the document intake surface. Classification organizes information; primary-source checks decide what becomes confirmed.',
};

const TONE_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  slate: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  purple: 'border-purple-500/30 bg-purple-500/10 text-purple-700',
};

export default function InboxPage() {
  const state = demoInbox();
  const stats = computeInboxStats(state);

  return (
    <main
      className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="inbox-page"
      data-is-demo={String(state.isDemo)}
      data-doc-count={String(stats.docCount)}
    >
      <header className="border-b border-border pb-3" data-testid="inbox-header">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          AI Knowledge Inbox
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
          Document intake
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Classification organizes information. Primary-source checks decide
          what becomes source-confirmed. Inferred fields are not verification
          claims.
        </p>
      </header>

      <p
        className="mt-4 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800"
        data-testid="inbox-demo-banner"
      >
        Demo intake — illustrative only, not a real clinician&rsquo;s documents
      </p>

      <StatsStrip state={state} />

      <DropzonePlaceholder />

      <div className="mt-6 grid grid-cols-12 gap-6">
        <aside
          className="col-span-12 lg:col-span-5 lg:sticky lg:top-[72px] lg:self-start"
          aria-label="Document list"
        >
          <DocumentList documents={state.documents} />
        </aside>
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {state.documents
            .filter((d) => d.state === 'processed')
            .map((doc) => (
              <DocumentDetail
                key={doc.id}
                doc={doc}
                fields={state.extractions[doc.id] ?? []}
              />
            ))}
        </div>
      </div>

      <SuggestionsSection suggestions={state.suggestions} />

      <ProvenanceLegend />
    </main>
  );
}

function StatsStrip({ state }: { state: InboxState }) {
  const stats = computeInboxStats(state);
  const cells = [
    { label: 'Documents',         value: stats.docCount,         testId: 'stat-docs' },
    { label: 'Processed',         value: stats.processed,        testId: 'stat-processed' },
    { label: 'Classifying',       value: stats.classifying,      testId: 'stat-classifying' },
    { label: 'Unclassified',      value: stats.unclassified,     testId: 'stat-unclassified' },
    { label: 'Extracted fields',  value: stats.extractedFields,  testId: 'stat-extracted' },
    { label: 'Suggestions',       value: stats.suggestionCount,  testId: 'stat-suggestions' },
  ];
  return (
    <section
      aria-labelledby="stats-heading"
      className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      data-testid="inbox-stats-strip"
    >
      <h2 id="stats-heading" className="sr-only">
        Inbox stats
      </h2>
      {cells.map((c) => (
        <div
          key={c.testId}
          className="rounded-md border border-border bg-card p-3"
          data-testid={c.testId}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {c.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
            {c.value}
          </p>
        </div>
      ))}
    </section>
  );
}

function DropzonePlaceholder() {
  // Phase 1 renders a placeholder dropzone — interactive upload is
  // Phase 2 work (needs auth + chunked upload + virus scan + the
  // real classifier). The page surfaces the affordance so a viewer
  // sees where uploads will live.
  return (
    <section
      aria-labelledby="dropzone-heading"
      className="mt-6 rounded-md border border-dashed border-border bg-muted/10 p-6 text-center"
      data-testid="inbox-dropzone-placeholder"
    >
      <h2 id="dropzone-heading" className="text-sm font-semibold text-foreground">
        Drop documents here (Phase 2)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload, classification, and OCR run in a queued worker. The current
        view renders the demo inbox state; live upload is wired in a later
        phase.
      </p>
    </section>
  );
}

function DocumentList({ documents }: { documents: ReadonlyArray<InboxDocument> }) {
  return (
    <ol
      className="rounded-md border border-border bg-card overflow-hidden"
      data-testid="inbox-document-list"
    >
      {documents.map((doc, i) => {
        const cls = doc.classification ? DOC_CLASS_META[doc.classification] : null;
        return (
          <li
            key={doc.id}
            className={`flex items-start gap-3 p-3 ${i < documents.length - 1 ? 'border-b border-border/50' : ''}`}
            data-doc-id={doc.id}
            data-doc-state={doc.state}
            data-classification={doc.classification ?? 'none'}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted/30 text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground"
              aria-hidden="true"
            >
              {cls?.glyph ?? '·'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatBytes(doc.bytes)} · {doc.pages} pp · {doc.receivedRel}
              </p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {cls?.label ?? 'pending'} ·{' '}
                <span data-doc-state-label={doc.state}>{doc.state}</span>
                {doc.classificationConfidence !== null && (
                  <>
                    {' '}
                    · {(doc.classificationConfidence * 100).toFixed(0)}%
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DocumentDetail({
  doc,
  fields,
}: {
  doc: InboxDocument;
  fields: ReadonlyArray<InboxExtractedField>;
}) {
  return (
    <section
      className="rounded-md border border-border bg-card p-5"
      aria-labelledby={`doc-${doc.id}-heading`}
      data-testid="inbox-document-detail"
      data-doc-id={doc.id}
    >
      <header className="mb-3 border-b border-border/50 pb-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {DOC_CLASS_META[doc.classification ?? 'unknown'].label}
        </p>
        <h2
          id={`doc-${doc.id}-heading`}
          className="text-base font-semibold text-foreground"
        >
          {doc.name}
        </h2>
        {doc.classificationReason && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {doc.classificationReason}
          </p>
        )}
      </header>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No extractions yet for this document.
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((f) => (
            <li
              key={f.fieldKey}
              className="rounded border border-border/60 bg-background/40 p-2.5"
              data-field-key={f.fieldKey}
              data-provenance={f.provenance}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </p>
                <ProvenanceBadge provenance={f.provenance} />
              </div>
              <p className="mt-1 text-sm text-foreground">{f.value}</p>
              {f.confidence !== null && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  AI confidence {(f.confidence * 100).toFixed(0)}%
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProvenanceBadge({ provenance }: { provenance: InboxProvenance }) {
  const meta = INBOX_PROVENANCE_META[provenance];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
      title={meta.description}
      data-provenance-label={meta.label}
    >
      <span aria-hidden="true">{meta.glyph}</span>
      {meta.label}
    </span>
  );
}

function SuggestionsSection({
  suggestions,
}: {
  suggestions: ReadonlyArray<InboxSuggestion>;
}) {
  return (
    <section
      aria-labelledby="suggestions-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="inbox-suggestions-section"
    >
      <h2 id="suggestions-heading" className="text-base font-semibold sm:text-lg">
        Suggested profile updates
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Inferred from the documents above. Accepting a suggestion writes a
        user-entered field to your profile — it does NOT mark the field as
        source-confirmed. A primary-source check is required for that.
      </p>
      {suggestions.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No suggestions.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="rounded border border-border/60 bg-background/40 p-3"
              data-testid="inbox-suggestion"
              data-suggestion-id={s.id}
              data-source-doc={s.sourceDocId}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  AI {(s.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Field <code className="font-mono">{s.fieldKey}</code>:
                proposed <span className="font-mono">{s.suggestedValue}</span>
                {s.currentValue !== null && (
                  <>
                    {' '}
                    · current <span className="font-mono">{s.currentValue}</span>
                  </>
                )}
              </p>
              <button
                type="button"
                disabled
                title="Accept-into-profile is a Phase 2 feature"
                className="mt-3 inline-flex items-center justify-center rounded border border-border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider opacity-50 cursor-not-allowed"
                data-testid="suggestion-accept-button"
                data-disabled-reason="phase-2-pending"
              >
                Accept (Phase 2)
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProvenanceLegend() {
  return (
    <section
      aria-labelledby="provenance-legend-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="inbox-provenance-legend"
    >
      <h2
        id="provenance-legend-heading"
        className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Provenance vocabulary
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries(INBOX_PROVENANCE_META).map(([key, meta]) => (
          <div key={key} className="rounded border border-border/60 p-3" data-provenance-key={key}>
            <dt className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ProvenanceBadge provenance={key as InboxProvenance} />
            </dt>
            <dd className="mt-2 text-[11px] text-muted-foreground">{meta.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
