'use client';

import * as React from 'react';

import { buildCoverLetterDraft } from '@/lib/career-garden/coverLetter';
import {
  AI_DRAFT_LINE,
  DRAFT_ONLY_LINE,
  type GardenOpportunity,
} from '@/lib/career-garden/demoData';
import type { GardenCvView } from '@/lib/career-garden/gardenViews';

import { GardenStamp } from './GardenStamp';

/**
 * The cover-letter drafting desk. A pure template over the facts the
 * clinician ticks — the letter re-derives from the selection every render,
 * the "Facts used in this draft" panel is the selection itself, and there
 * is deliberately no send button anywhere on this surface.
 *
 * Server-side rendering uses the default selection (all base facts), so the
 * full draft reads with JavaScript off; checkboxes are the enhancement.
 */
export function CoverLetterComposer({
  opportunity,
  facts,
}: {
  opportunity: GardenOpportunity;
  facts: GardenCvView[];
}) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() => facts.map((f) => f.id));
  const [copied, setCopied] = React.useState(false);

  const selectedFacts = facts.filter((f) => selectedIds.includes(f.id));
  const draft = buildCoverLetterDraft(opportunity, selectedFacts);

  const toggle = (id: string) => {
    setCopied(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" aria-labelledby="composer-heading">
      <div>
        <h4 id="composer-heading" className="mz-card-ttl">
          Facts used in this draft
        </h4>
        <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
          The letter is assembled only from the lines you tick. Untick a line and it leaves the draft.
        </p>
        {facts.length === 0 ? (
          <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
            No Living CV lines yet — grow one from a note first; drafts only rest on lines you approved.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {facts.map((fact) => (
            <li key={fact.id} className="mz-card p-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(fact.id)}
                  onChange={() => toggle(fact.id)}
                  className="mt-1"
                  aria-label={`Use “${fact.headline}” in the draft`}
                />
                <span className="min-w-0">
                  <span className="mz-body block font-medium" style={{ color: 'var(--ink-900)' }}>
                    {fact.headline}
                  </span>
                  <span className="mt-1 inline-flex">
                    <GardenStamp provenance={fact.provenance} />
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="mz-card-ttl">Draft letter</h4>
          <span className="mz-chip mz-chip-watch">
            <span className="mz-gl" aria-hidden="true" />
            {DRAFT_ONLY_LINE}
          </span>
        </div>
        <pre
          className="mz-inset mt-3 whitespace-pre-wrap p-4 text-[0.9375rem] leading-[1.55]"
          style={{ fontFamily: 'var(--font-body, inherit)', color: 'var(--ink-700)' }}
        >
          {draft}
        </pre>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="mz-btn-ghost mz-btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(draft).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy draft'}
          </button>
          <span className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
            {AI_DRAFT_LINE} Sending and applying stay outside this prototype.
          </span>
        </div>
      </div>
    </div>
  );
}
