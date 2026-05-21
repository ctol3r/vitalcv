import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Final summary panel for the /demo/waste route. Pulls the six
 * narratives together with a single-sentence framing per narrative
 * and a single-line "what stays institution-owned" line. The panel
 * deliberately avoids any quantitative ROI claim; the only numeric
 * claims (time-to-resolution, operator minutes) are the pilot
 * targets already documented in the deployment readiness fixture.
 */
export interface WasteVisibilitySummaryProps {
  className?: string;
}

interface SummaryRow {
  narrative: string;
  oneSentence: string;
  institutionOwned: string;
}

const SUMMARY_ROWS: readonly SummaryRow[] = [
  {
    narrative: '01 · duplicate outreach',
    oneSentence:
      'The same federal source gets queried multiple times; the replay envelope carries the lane forward.',
    institutionOwned:
      'Receiving institution still reviews each lane on its own credential.',
  },
  {
    narrative: '02 · continuity interruption',
    oneSentence:
      'Upstream registry blips today become phone-tag; the operator note travels with the lane instead.',
    institutionOwned:
      'Receiving institution dispositions stale-but-signed lanes on its own credential.',
  },
  {
    narrative: '03 · evidence fragmentation',
    oneSentence:
      'Federal-source fragments live in different systems; the envelope reorganizes only the federal-source ones.',
    institutionOwned:
      'Institution records, committee minutes, and notes stay institution-owned.',
  },
  {
    narrative: '04 · operational dead time',
    oneSentence:
      'Five categories of dead time exist; only federal-source resolution wait compresses.',
    institutionOwned:
      'Committee, privileging, and re-fetch cadences remain institution-owned.',
  },
  {
    narrative: '05 · manual review loops',
    oneSentence:
      'Some review is re-reading the packet; the envelope carries the lane so subsequent reviewers read it in place.',
    institutionOwned:
      'Committee judgement and privileging decisions remain institution-owned.',
  },
  {
    narrative: '06 · deployment delay',
    oneSentence:
      'Three axes hold deployment up; only the federal-source axis compresses.',
    institutionOwned:
      'Committee and privileging cadence remain institution-owned.',
  },
];

const STAYS_INSTITUTION_OWNED: readonly string[] = [
  'State medical board PSV (Cedar CVO channel)',
  'Credentialing committee review',
  'Privileging decisions',
  'Final acceptance of any clinician for deployment',
  'Re-fetching upstream registries on the institution\'s own credential and freshness budget',
  'Disposition of stale-but-signed lanes',
];

export function WasteVisibilitySummary({
  className,
}: WasteVisibilitySummaryProps) {
  return (
    <section
      data-slot="waste-visibility-summary"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Waste visibility · summary
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          A single page reading of where credentialing operations leak
          today, paired with the institution-owned step that does not
          move. The page does not claim savings or quantitative ROI;
          it demonstrates visibility, not elimination.
        </p>
      </header>

      <ul className="divide-y divide-slate-200">
        {SUMMARY_ROWS.map((row) => (
          <li
            key={row.narrative}
            data-slot="waste-visibility-summary-row"
            data-narrative-id={row.narrative.split(' ')[0]}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Narrative
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {row.narrative}
              </div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What the page demonstrates
              </div>
              <div className="mt-1 text-xs text-slate-700">{row.oneSentence}</div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What stays institution-owned
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {row.institutionOwned}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section
        data-slot="waste-visibility-summary-institution-owned"
        className="border-t border-slate-200 bg-slate-50 px-4 py-3"
      >
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Institution-owned in full · the page names these explicitly
        </div>
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">
          {STAYS_INSTITUTION_OWNED.map((item) => (
            <li
              key={item}
              data-slot="waste-visibility-summary-institution-owned-item"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        Visibility, not elimination · no ROI or savings claim on this page
      </footer>
    </section>
  );
}
