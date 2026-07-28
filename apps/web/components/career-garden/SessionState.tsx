'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  CV_SECTION_LABEL,
  NOTE_PRIVACY_LINE,
  type CvEntry,
  type GardenSeed,
} from '@/lib/career-garden/demoData';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { GardenStamp } from './GardenStamp';
import { useGardenWorkspace } from './GardenWorkspaceProvider';

/**
 * The small client islands that carry session-only, reversible state:
 * approving a grow draft into the Living CV, and listing Cursor captures.
 * Everything here is React state from GardenWorkspaceProvider — no storage,
 * no network — and every action has a one-click undo.
 */

export function ApproveDraftPanel({ seed, mount }: { seed: GardenSeed; mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const { approvedEntries, approveDraft, removeApproved } = useGardenWorkspace();
  const entryId = `session-${seed.id}`;
  const approved = approvedEntries.some((e) => e.id === entryId);

  const entry: CvEntry = {
    id: entryId,
    section: seed.growDraft.section,
    headline: seed.growDraft.headline,
    detail: seed.growDraft.detail,
    provenance: 'self-attested',
    origin: [`Grown from your note “${seed.title}” — approved by you this session.`],
    branchIds: seed.branchIds,
    fromSeedId: seed.id,
  };

  return (
    <div className="mt-4 border-t border-[var(--rule)] pt-3">
      {approved ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mz-body">
            Approved — it now appears in your{' '}
            <Link href={hrefFor('cv')} className="underline underline-offset-4">
              Living CV
            </Link>{' '}
            for this session.
          </p>
          <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => removeApproved(entryId)}>
            Undo
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="mz-btn mz-btn-sm" onClick={() => approveDraft(entry)}>
            Approve — add to Living CV
          </button>
          <Link href={hrefFor('notes', { note: seed.id })} className="mz-btn-ghost mz-btn-sm">
            Not now
          </Link>
        </div>
      )}
      <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
        Session-only in this prototype: approvals are reversible and clear when you leave.
      </p>
      <noscript>
        <p className="mz-small mt-2">Approving needs JavaScript in this prototype; the draft above is the full preview.</p>
      </noscript>
    </div>
  );
}

export function SessionCapturesList({ mount }: { mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const { captures, removeCapture } = useGardenWorkspace();
  if (captures.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mz-card-ttl">Captured this session</h3>
      <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
        {NOTE_PRIVACY_LINE} These clear when you leave — persistence is a later wave.
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

export function SessionCvAdditions({ section }: { section: CvEntry['section'] }) {
  const { approvedEntries, removeApproved } = useGardenWorkspace();
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
            Approved this session ({CV_SECTION_LABEL[entry.section]}) — not persisted in this prototype.
          </p>
        </li>
      ))}
    </>
  );
}
