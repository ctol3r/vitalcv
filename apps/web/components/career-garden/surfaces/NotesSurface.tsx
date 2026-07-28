import Link from 'next/link';

import {
  AI_DRAFT_LINE,
  CV_SECTION_LABEL,
  DEMO_SEEDS,
  NOTE_PRIVACY_LINE,
  branchName,
  findSeed,
} from '@/lib/career-garden/demoData';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { GardenStamp } from '../GardenStamp';
import { ApproveDraftPanel, SessionCapturesList } from '../SessionState';
import { CursorContextBinding } from '../GardenWorkspaceProvider';

/**
 * Notes — the seed bed. A private note is a Seed; "Grow into CV draft"
 * opens a review panel whose outcome is always a self-attested draft that
 * the clinician must explicitly approve. Nothing grows on its own.
 *
 * The list, the note detail, and the review panel are all server-rendered
 * (selection travels in the URL), so the whole flow reads with JS off; only
 * the final approve action needs a running session.
 */
export function NotesSurface({
  selectedId,
  grow,
  mount,
}: {
  selectedId?: string;
  grow?: boolean;
  mount: GardenMount;
}) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const selected = findSeed(selectedId);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {selected ? (
        <CursorContextBinding context={{ type: 'note', id: selected.id, label: selected.title }} />
      ) : null}

      {/* Seed list */}
      <section aria-labelledby="notes-list-heading">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="notes-list-heading" className="mz-h2">
            Seeds
          </h2>
          <span className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
            {DEMO_SEEDS.length} private notes
          </span>
        </div>
        <p className="mz-small mt-1.5" style={{ color: 'var(--vt-text-muted)' }}>
          {NOTE_PRIVACY_LINE} Notes never leave this bed on their own.
        </p>
        <ul className="mt-4 space-y-2">
          {DEMO_SEEDS.map((seed) => {
            const isSelected = seed.id === selected?.id;
            return (
              <li key={seed.id}>
                <Link
                  href={hrefFor('notes', { note: seed.id })}
                  aria-current={isSelected ? 'true' : undefined}
                  className="mz-card mz-interactive block p-4"
                  style={isSelected ? { borderColor: 'var(--ink-700)' } : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                      {seed.title}
                    </p>
                    <span className="mz-mono shrink-0 text-[11px]" style={{ color: 'var(--ink-500)' }}>
                      {seed.capturedAt}
                    </span>
                  </div>
                  <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
                    {seed.status === 'growing' ? 'Growing — a CV draft awaits your review' : 'Unfiled seed'}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
        <SessionCapturesList mount={mount} />
      </section>

      {/* Detail + grow review */}
      <section aria-labelledby="note-detail-heading">
        {selected ? (
          <article className="mz-card p-5">
            <p className="mz-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink-500)' }}>
              Private note · {NOTE_PRIVACY_LINE}
            </p>
            <h2 id="note-detail-heading" className="mz-h2 mt-2">
              {selected.title}
            </h2>
            <p className="mz-mono mt-1 text-[11px]" style={{ color: 'var(--ink-500)' }}>
              Captured {selected.capturedAt}
            </p>
            <p className="mz-body mt-4">{selected.body}</p>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {selected.tags.map((tag) => (
                <span key={tag} className="mz-chip mz-chip-unknown">
                  <span className="mz-gl" aria-hidden="true" />
                  {tag}
                </span>
              ))}
              {selected.branchIds.map((id) => (
                <span key={id} className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
                  → {branchName(id)}
                </span>
              ))}
            </div>

            {!grow ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--rule)] pt-4">
                <Link href={hrefFor('notes', { note: selected.id, grow: '1' })} className="mz-btn mz-btn-sm">
                  Grow into CV draft
                </Link>
                <span className="mz-small self-center" style={{ color: 'var(--vt-text-muted)' }}>
                  Opens a review panel — nothing changes without your approval.
                </span>
              </div>
            ) : (
              <div className="mz-inset mt-5 p-4" aria-labelledby="grow-review-heading">
                <p id="grow-review-heading" className="mz-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink-500)' }}>
                  Review before it blooms
                </p>
                <div className="mt-3 rounded-[3px] border border-[var(--rule)] p-3" style={{ background: 'var(--card)' }}>
                  <p className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
                    Proposed line for {CV_SECTION_LABEL[selected.growDraft.section]}
                  </p>
                  <p className="mz-body mt-2 font-medium" style={{ color: 'var(--ink-900)' }}>
                    {selected.growDraft.headline}
                  </p>
                  <p className="mz-body mt-1">{selected.growDraft.detail}</p>
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
                    <li className="mz-small">Your note “{selected.title}”, captured {selected.capturedAt}.</li>
                    <li className="mz-small">Nothing else — a draft never borrows facts you did not write.</li>
                  </ul>
                </div>

                <ApproveDraftPanel seed={selected} mount={mount} />
              </div>
            )}
          </article>
        ) : (
          <div className="mz-card p-5">
            <h2 id="note-detail-heading" className="mz-h2">
              Pick a seed
            </h2>
            <p className="mz-body mt-2">
              Select a note to read it, organize it, or grow it into a CV draft. New thoughts land here too — press{' '}
              <kbd className="mz-mono">⌘K</kbd> and choose Capture.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
