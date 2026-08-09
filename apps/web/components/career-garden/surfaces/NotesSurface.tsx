import Link from 'next/link';
import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';

import { NOTE_PRIVACY_LINE } from '@/lib/career-garden/demoData';
import type { GardenData } from '@/lib/career-garden/gardenViews';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { ApprovePanel, SessionCapturesList } from '../SessionState';
import { CursorContextBinding } from '../GardenWorkspaceProvider';

/**
 * Notes — the seed bed. A private note is a Seed; "Grow into CV draft"
 * opens a review panel where the clinician edits every word and explicitly
 * approves before anything reaches the Living CV. Nothing grows on its own.
 *
 * Live mount renders durable notes from the workspace; the fixture mount
 * renders the sample dataset. List, detail, and review panel are
 * server-rendered (selection travels in the URL) so the flow reads with
 * JavaScript off; only the approve action needs a running session.
 */
export function NotesSurface({
  data,
  selectedId,
  grow,
  mount,
}: {
  data: GardenData;
  selectedId?: string;
  grow?: boolean;
  mount: GardenMount;
}) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const selected = data.notes.find((n) => n.id === selectedId);
  const live = data.mode === 'live';

  const statusLine = (status: 'unfiled' | 'growing' | 'grown') =>
    status === 'growing'
      ? 'Growing — a CV draft awaits your review'
      : status === 'grown'
        ? 'Grown — it lives in your Living CV now'
        : 'Unfiled seed';

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
            {data.notes.length} private note{data.notes.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mz-small mt-1.5" style={{ color: 'var(--vt-text-muted)' }}>
          {NOTE_PRIVACY_LINE} Notes never leave this bed on their own. Keep patient details out — this is
          for your professional life, not clinical records.
        </p>

        {data.mode === 'unavailable' ? (
          <p className="mz-inset mz-small mt-4 p-3" role="status">
            {WORKBENCH_BRANDING.storageName} is temporarily unavailable — notes cannot be read or saved right now. Nothing
            was lost; try again shortly.
          </p>
        ) : data.notes.length === 0 ? (
          <div className="mz-card mt-4 p-4">
            <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
              No seeds yet
            </p>
            <p className="mz-small mt-1">
              Press <kbd className="mz-mono">⌘K / Ctrl+K</kbd> and choose Capture — a stray thought after rounds is
              exactly the right size.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.notes.map((note) => {
              const isSelected = note.id === selected?.id;
              return (
                <li key={note.id}>
                  <Link
                    href={hrefFor('notes', { note: note.id })}
                    aria-current={isSelected ? 'true' : undefined}
                    className="mz-card mz-interactive block p-4"
                    style={isSelected ? { borderColor: 'var(--ink-700)' } : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                        {note.title}
                      </p>
                      <span className="mz-mono shrink-0 text-[11px]" style={{ color: 'var(--ink-500)' }}>
                        {note.capturedAt}
                      </span>
                    </div>
                    <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
                      {statusLine(note.status)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
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
            <p className="mz-body mt-4 whitespace-pre-wrap">{selected.body}</p>

            {selected.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {selected.tags.map((tag) => (
                  <span key={tag} className="mz-chip mz-chip-unknown">
                    <span className="mz-gl" aria-hidden="true" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {selected.status === 'grown' ? (
              <div className="mt-5 border-t border-[var(--rule)] pt-4">
                <p className="mz-body">
                  This seed has grown — its line lives in your{' '}
                  <Link href={hrefFor('cv')} className="underline underline-offset-4">
                    Living CV
                  </Link>
                  . Removing the line there reopens the seed.
                </p>
              </div>
            ) : !grow ? (
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
                <p
                  id="grow-review-heading"
                  className="mz-mono text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: 'var(--ink-500)' }}
                >
                  Review before it blooms
                </p>
                <ApprovePanel note={selected} mount={mount} />
              </div>
            )}
          </article>
        ) : (
          <div className="mz-card p-5">
            <h2 id="note-detail-heading" className="mz-h2">
              Pick a seed
            </h2>
            <p className="mz-body mt-2">
              Select a note to read it, organize it, or grow it into a CV draft. New thoughts land here too —
              press <kbd className="mz-mono">⌘K / Ctrl+K</kbd> and choose Capture.
            </p>
            {live ? (
              <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
                Captures here are saved to your private workspace and stay yours to delete.
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
