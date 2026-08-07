'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  AI_DRAFT_LINE,
  CV_SECTION_LABEL,
  type CvEntry,
  type CvSection,
} from '@/lib/career-garden/demoData';
import { growPrefill, type GardenNoteView } from '@/lib/career-garden/gardenViews';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { GardenStamp } from './GardenStamp';
import { useGardenWorkspace } from './GardenWorkspaceProvider';

/**
 * Client islands for the grow-and-approve flow and its reversals.
 *
 * The review form is the whole point: the clinician edits the proposed
 * wording, chooses the section, and only their explicit Approve makes a
 * Living CV line. Live mount persists through the garden proxies; fixture
 * mount keeps the session-only prototype mechanics.
 */

const SECTION_OPTIONS: CvSection[] = ['experience', 'research', 'teaching', 'service', 'publications'];

export function ApprovePanel({ note, mount }: { note: GardenNoteView; mount: GardenMount }) {
  const ws = useGardenWorkspace();
  const hrefFor = GARDEN_HREF_FOR[mount];
  const live = ws.data.mode === 'live';
  const prefill = React.useMemo(() => growPrefill(note), [note]);

  const [section, setSection] = React.useState<CvSection | ''>(prefill.section);
  const [headline, setHeadline] = React.useState(prefill.headline);
  const [detail, setDetail] = React.useState(prefill.detail);
  const [approvedEntryId, setApprovedEntryId] = React.useState<string | null>(null);

  const fixtureEntryId = `session-${note.id}`;
  const fixtureApproved = ws.approvedEntries.some((e) => e.id === fixtureEntryId);
  const approved = live ? approvedEntryId !== null : fixtureApproved;

  const canApprove = Boolean(section && headline.trim() && detail.trim()) && !ws.pending;

  const approve = async () => {
    if (!section) return;
    if (live) {
      const entryId = await ws.promoteLiveNote(note.id, {
        section,
        headline: headline.trim(),
        detail: detail.trim(),
      });
      if (entryId) setApprovedEntryId(entryId);
      return;
    }
    const entry: CvEntry = {
      id: fixtureEntryId,
      section,
      headline: headline.trim(),
      detail: detail.trim(),
      provenance: 'self-attested',
      origin: [`Grown from your note “${note.title}” — approved by you this session.`],
      branchIds: [],
      fromSeedId: note.id,
    };
    ws.approveDraft(entry);
  };

  const undo = async () => {
    if (live) {
      if (approvedEntryId && (await ws.removeLiveCvEntry(approvedEntryId))) {
        setApprovedEntryId(null);
      }
      return;
    }
    ws.removeApproved(fixtureEntryId);
  };

  return (
    <div className="mt-3">
      <div className="rounded-[3px] border border-[var(--rule)] p-3" style={{ background: 'var(--card)' }}>
        <p className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
          Proposed line — edit every word before it blooms
        </p>
        <label className="mz-small mt-3 block">
          Section
          <select
            className="mz-input mt-1 w-full"
            value={section}
            onChange={(e) => setSection(e.target.value as CvSection | '')}
            aria-label="CV section for this line"
          >
            <option value="" disabled>
              Choose a section…
            </option>
            {SECTION_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {CV_SECTION_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="mz-small mt-2 block">
          Headline
          <input
            className="mz-input mt-1 w-full"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            aria-label="CV line headline"
            maxLength={200}
          />
        </label>
        <label className="mz-small mt-2 block">
          Detail
          <textarea
            className="mz-input mt-1 w-full"
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            aria-label="CV line detail"
            maxLength={600}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GardenStamp provenance="self-attested" />
          <span className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
            {AI_DRAFT_LINE}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <p className="mz-small mz-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ink-500)' }}>
          Facts used in this draft
        </p>
        <ul className="mt-1.5 space-y-1">
          <li className="mz-small">Your note “{note.title}”, captured {note.capturedAt}.</li>
          <li className="mz-small">Nothing else — a draft never borrows facts you did not write.</li>
        </ul>
      </div>

      <div className="mt-4 border-t border-[var(--rule)] pt-3">
        {approved ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mz-body">
              Approved — it now appears in your{' '}
              <Link href={hrefFor('cv')} className="underline underline-offset-4">
                Living CV
              </Link>
              .
            </p>
            <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={undo} disabled={ws.pending}>
              Undo
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="mz-btn mz-btn-sm" onClick={approve} disabled={!canApprove}>
              {ws.pending ? 'Saving…' : 'Approve — add to Living CV'}
            </button>
            <Link href={hrefFor('notes', { note: note.id })} className="mz-btn-ghost mz-btn-sm">
              Not now
            </Link>
          </div>
        )}
        {ws.lastError ? (
          <p className="mz-small mt-2" role="alert" style={{ color: 'var(--watch)' }}>
            {ws.lastError}
          </p>
        ) : null}
        <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
          {live
            ? 'Approvals are yours to reverse — removing the line reopens this seed.'
            : 'Session-only in this prototype: approvals are reversible and clear when you leave.'}
        </p>
        <noscript>
          <p className="mz-small mt-2">Approving needs JavaScript; the draft above is the full preview.</p>
        </noscript>
      </div>
    </div>
  );
}

/** Fixture-only: session captures listed under the seed bed (harness). */
export function SessionCapturesList({ mount }: { mount: GardenMount }) {
  const { captures, removeCapture, data } = useGardenWorkspace();
  const hrefFor = GARDEN_HREF_FOR[mount];
  if (data.mode === 'live' || captures.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mz-card-ttl">Captured this session</h3>
      <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
        Only you can see this. These clear when you leave — the live garden persists them.
      </p>
      <ul className="mt-2 space-y-2">
        {captures.map((c) => (
          <li key={c.id} className="mz-card flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                {c.title}
              </p>
              <p className="mz-small mt-0.5 line-clamp-2">{c.body}</p>
            </div>
            <button type="button" className="mz-btn-ghost mz-btn-sm shrink-0" onClick={() => removeCapture(c.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className="mz-small mt-2">
        <Link href={hrefFor('home')} className="underline underline-offset-4">
          Back to the garden
        </Link>
      </p>
    </div>
  );
}

/** Fixture-only: session-approved lines rendered into the Living CV sections. */
export function SessionCvAdditions({ section }: { section: CvSection }) {
  const { approvedEntries, removeApproved, data } = useGardenWorkspace();
  if (data.mode === 'live') return null;
  const inSection = approvedEntries.filter((e) => e.section === section);
  if (inSection.length === 0) return null;
  return (
    <>
      {inSection.map((entry) => (
        <li key={entry.id} className="border-b border-[var(--rule-soft)] py-4 last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
              {entry.headline}
            </p>
            <div className="flex items-center gap-2">
              <GardenStamp provenance={entry.provenance} />
              <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => removeApproved(entry.id)}>
                Remove
              </button>
            </div>
          </div>
          <p className="mz-body mt-1">{entry.detail}</p>
          <p className="mz-small mt-1.5" style={{ color: 'var(--vt-text-muted)' }}>
            Approved this session ({CV_SECTION_LABEL[entry.section]}) — not persisted in the harness.
          </p>
        </li>
      ))}
    </>
  );
}

/** Live-only: remove a grown line; the backend reopens its seed. */
export function RemoveCvEntryButton({ entryId }: { entryId: string }) {
  const ws = useGardenWorkspace();
  if (ws.data.mode !== 'live') return null;
  return (
    <button
      type="button"
      className="mz-btn-ghost mz-btn-sm"
      disabled={ws.pending}
      onClick={() => void ws.removeLiveCvEntry(entryId)}
    >
      Remove
    </button>
  );
}
