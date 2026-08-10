import Link from 'next/link';

import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import {
  DEMO_OPPORTUNITIES,
  findOpportunity,
} from '@/lib/career-garden/demoData';
import type { GardenData } from '@/lib/career-garden/gardenViews';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { CoverLetterComposer } from '../CoverLetterComposer';
import { CursorContextBinding } from '../GardenWorkspaceProvider';

/**
 * The preparation studio — two fictional postings for practicing the
 * Prepare flow: read the terms, see which evidence stands and which needs
 * you, and draft a cover letter from facts you select. Real opportunities
 * live in MATCHA; this studio links there and never duplicates it.
 */
export function OpportunitiesSurface({
  data,
  selectedId,
  compose,
  mount,
}: {
  data: GardenData;
  selectedId?: string;
  compose?: boolean;
  mount: GardenMount;
}) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const selected = findOpportunity(selectedId);

  return (
    <div className="space-y-8">
      {selected ? (
        <CursorContextBinding context={{ type: 'opportunity', id: selected.id, label: selected.title }} />
      ) : null}

      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mz-h2">Preparation studio</h2>
          <span className="mz-chip mz-chip-watch">
            <span className="mz-gl" aria-hidden="true" />
            Sample postings
          </span>
        </div>
        <p className="mz-body mt-2" style={{ color: 'var(--ink-600)' }}>
          Practice the move before you make it. Everything on this page is fictional and private to you.
        </p>
        <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
          Real roles live in{' '}
          <Link href="/holder/opportunities" className="underline underline-offset-4">
            Role search
          </Link>{' '}
          and the{' '}
          <Link href="/holder/opportunities/discover" className="underline underline-offset-4">
            discover deck
          </Link>
          ; your live applications sit under{' '}
          <Link href="/holder/applications" className="underline underline-offset-4">
            Updates
          </Link>
          .
        </p>
      </header>

      <section aria-label="Sample postings" className="grid gap-3 md:grid-cols-2">
        {DEMO_OPPORTUNITIES.map((opp) => {
          const isSelected = opp.id === selected?.id;
          return (
            <Link
              key={opp.id}
              href={hrefFor('opportunities', { op: opp.id })}
              aria-current={isSelected ? 'true' : undefined}
              className="mz-card mz-interactive block p-4"
              style={isSelected ? { borderColor: 'var(--ink-700)' } : undefined}
            >
              <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                {opp.title}
              </p>
              <p className="mz-small mt-0.5">{opp.org}</p>
              <dl className="mz-mono mt-3 space-y-1 text-[11.5px]" style={{ color: 'var(--ink-600)' }}>
                <div className="flex justify-between gap-3">
                  <dt>Location</dt>
                  <dd className="text-right">{opp.location}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Schedule</dt>
                  <dd className="text-right">{opp.schedule}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Stated pay</dt>
                  <dd className="text-right">{opp.compensation}</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </section>

      {selected ? (
        <article className="mz-card p-5" aria-labelledby="opp-detail-heading">
          <h3 id="opp-detail-heading" className="mz-h2">
            {selected.title}
          </h3>
          <p className="mz-small mt-0.5">{selected.org}</p>

          <dl className="mz-mono mt-4 grid gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-2" style={{ color: 'var(--ink-600)' }}>
            {(
              [
                ['Location', selected.location],
                ['Schedule', selected.schedule],
                ['Stated pay', selected.compensation],
                ['Practice model', selected.practiceModel],
                ['Team', selected.team],
                ['Timeline', selected.timeline],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-[var(--rule-soft)] py-1.5">
                <dt>{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <h4 className="mz-eyebrow">Why this may fit</h4>
            <ul className="mt-2 space-y-1.5">
              {selected.fitReasons.map((reason) => (
                <li key={reason} className="mz-body flex gap-2">
                  <span aria-hidden="true" style={{ color: 'var(--ink-400)' }}>
                    ·
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
            <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
              Drawn from preferences and notes in this sample workspace. No odds, no scores — those are refusals,
              not omissions.
            </p>
          </div>

          <div className="mt-5">
            <h4 className="mz-eyebrow">Evidence this posting asks for</h4>
            <ul className="mt-2">
              {[...selected.requiredEvidence.map((e) => ({ ...e, required: true })), ...selected.optionalEvidence.map((e) => ({ ...e, required: false }))].map(
                (item) => (
                  <li
                    key={item.label}
                    className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--rule-soft)] py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                        {item.label}
                        {item.required ? null : (
                          <span className="mz-small ml-2" style={{ color: 'var(--vt-text-muted)' }}>
                            optional
                          </span>
                        )}
                      </p>
                      <p className="mz-small mt-0.5">{item.note}</p>
                    </div>
                    <StateChip state={item.state} attribution="legend" size="sm" />
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-4">
            {!compose ? (
              <Link href={hrefFor('opportunities', { op: selected.id, compose: '1' })} className="mz-btn mz-btn-sm">
                Draft a cover letter
              </Link>
            ) : null}
            <span className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
              Drafting happens here; applying happens under Roles when you choose to.
            </span>
          </div>

          {compose ? (
            <CoverLetterComposer opportunity={selected} facts={data.cvEntries} />
          ) : null}
        </article>
      ) : (
        <p className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
          Pick a sample posting to see its terms, evidence asks, and the drafting desk.
        </p>
      )}
    </div>
  );
}
