import Link from 'next/link';

import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import {
  DEMO_CV_ENTRIES,
  DEMO_PUB_CANDIDATES,
  DEMO_RESEARCH_ITEMS,
  branchName,
} from '@/lib/career-garden/demoData';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { GardenStamp } from '../GardenStamp';
import { CursorContextBinding } from '../GardenWorkspaceProvider';

/**
 * Research — the reading shelf and the candidate queue. The load-bearing
 * rule renders right on the surface: an author-name match is a candidate
 * for the clinician's review, never an authorship assertion.
 */
export function ResearchSurface({ selectedId, mount }: { selectedId?: string; mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const selected = DEMO_RESEARCH_ITEMS.find((r) => r.id === selectedId);
  const confirmedPublications = DEMO_CV_ENTRIES.filter((e) => e.section === 'publications');

  // A5 (2026-08-08): the production mount renders honest absence — the shelf
  // and candidate queue are fictional sample content whose live wave has not
  // shipped, and sample material no longer ships on the main Workbench path.
  // The harness mount keeps the demo for design review.
  if (mount === 'holder') {
    return (
      <div className="space-y-10">
        <section aria-labelledby="research-shelf">
          <h2 id="research-shelf" className="mz-h2">
            Reading shelf
          </h2>
          <div className="mz-card mt-4 p-5">
            <p className="mz-body">
              Nothing on your shelf yet. Capture an insight or a teaching point with the Cursor
              (⌘K / Ctrl+K) — it lands in your private notes today; the research shelf itself
              arrives in a later wave.
            </p>
          </div>
        </section>
        <section aria-labelledby="research-candidates">
          <h2 id="research-candidates" className="mz-h2">
            Publication candidates
          </h2>
          <div className="mz-card mt-4 p-5">
            <p className="mz-body">
              No candidates yet. When publication matching ships, an author-name match will appear
              here as a candidate for your review — never as an authorship assertion.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {selected ? (
        <CursorContextBinding context={{ type: 'research', id: selected.id, label: selected.title }} />
      ) : null}

      <section aria-labelledby="research-shelf">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="research-shelf" className="mz-h2">
            Reading shelf
          </h2>
          <span className="mz-chip mz-chip-watch">
            <span className="mz-gl" aria-hidden="true" />
            Sample items
          </span>
        </div>
        <p className="mz-small mt-1.5" style={{ color: 'var(--vt-text-muted)' }}>
          Private annotations — save an insight or a teaching point with the Cursor (⌘K / Ctrl+K). Everything on
          this shelf is fictional sample content — its live wave comes next.
        </p>
        <ul className="mt-4 space-y-3">
          {DEMO_RESEARCH_ITEMS.map((item) => (
            <li key={item.id} className="mz-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                  {item.title}
                </p>
                <span className="mz-mono text-[11px]" style={{ color: 'var(--ink-500)' }}>
                  {item.addedAt}
                </span>
              </div>
              <p className="mz-mono mt-0.5 text-[11px]" style={{ color: 'var(--ink-500)' }}>
                {item.venue}
              </p>
              <p className="mz-body mt-2">{item.annotation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.branchIds.map((id) => (
                  <span key={id} className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
                    → {branchName(id)}
                  </span>
                ))}
                <Link
                  href={hrefFor('research', { item: item.id })}
                  className="mz-small underline underline-offset-4"
                  aria-label={`Focus ${item.title} for the Cursor`}
                >
                  Focus
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="research-candidates">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="research-candidates" className="mz-h2">
            Publication candidates
          </h2>
          <StateChip state="needs_review" attribution="legend" size="sm" />
        </div>
        <p className="mz-body mt-2" style={{ color: 'var(--ink-600)' }}>
          Matched by author name from your saved Scholar link. A name match is a candidate for your review —
          never an authorship claim.
        </p>
        <ul className="mt-4 space-y-3">
          {DEMO_PUB_CANDIDATES.map((cand) => (
            <li key={cand.id} className="mz-card flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                  {cand.title}
                </p>
                <p className="mz-mono mt-0.5 text-[11px]" style={{ color: 'var(--ink-500)' }}>
                  {cand.venue}
                </p>
                <p className="mz-small mt-1.5" style={{ color: 'var(--vt-text-muted)' }}>
                  {cand.matchedBy}. Confirming or dismissing is part of the next wave — nothing happens to a
                  candidate in this prototype.
                </p>
              </div>
              <GardenStamp provenance="candidate-match" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="research-confirmed">
        <h2 id="research-confirmed" className="mz-h2">
          In your Living CV
        </h2>
        <ul className="mt-3 space-y-2">
          {confirmedPublications.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule-soft)] py-3 last:border-0">
              <p className="mz-body">{entry.headline}</p>
              <div className="flex items-center gap-2">
                <GardenStamp provenance={entry.provenance} />
                <Link href={hrefFor('cv')} className="mz-small underline underline-offset-4">
                  View in CV
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
