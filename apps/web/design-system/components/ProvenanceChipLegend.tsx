import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ProvenanceChip,
  PROVENANCE_META,
  PROVENANCE_CORE_ORDER,
  PROVENANCE_ORDER,
  type ProvenanceState,
} from './ProvenanceChip';

/**
 * ProvenanceChipLegend — documents the ProvenanceChip register with an
 * example provenance line per state, so a reader sees exactly how each
 * status carries its source and timestamp. Pure/SSR-safe.
 */

export interface ProvenanceLegendRow {
  state: ProvenanceState;
  /** Overrides the default meaning sentence. */
  meaning?: string;
  /** Example provenance shown on the chip (illustrative). */
  source?: string;
  timestamp?: string;
  detail?: string;
}

/** Illustrative provenance for each state, used by the default legends. */
const EXAMPLE: Partial<Record<ProvenanceState, Omit<ProvenanceLegendRow, 'state'>>> = {
  checked: { source: 'NPPES', timestamp: '2026-07-14T09:12:00Z' },
  gated: { source: 'DEA', detail: 'access required' },
  accessRequired: { source: 'PECOS', detail: 'authorization needed' },
  stale: { source: 'State board', detail: '214d ago' },
  pending: { source: 'OIG LEIE', detail: 'querying' },
  reviewRequired: { source: 'Committee', detail: 'routed 2026-07-16' },
  // NPPES, not NPDB. `unavailable` means "the source did not return a payload
  // on this attempt" — a system condition — so the example must name a source
  // VitalCV actually queries. NPDB is not integrated at all, so showing it here
  // implied a read that never happens, and EC-3 bans the noun in customer-facing
  // copy. Reusing NPPES (also the `checked` example) is deliberate: the same
  // source in two states is the clearest way to show that VitalCV reports the
  // attempt rather than inventing a value.
  unavailable: { source: 'NPPES', detail: 'no payload' },
  notDecisionGrade: { source: 'Preview feed', detail: 'insufficient' },
  previewOnly: { detail: 'synthetic data' },
  revoked: { source: 'Issuer', timestamp: '2026-06-30T00:00:00Z', detail: 'fails closed' },
  selfAttested: { detail: 'entered by holder' },
};

function rowsFrom(order: ReadonlyArray<ProvenanceState>): ProvenanceLegendRow[] {
  return order.map((state) => ({ state, ...EXAMPLE[state] }));
}

/** The compact six-register set most surfaces show. */
export const PROVENANCE_LEGEND_ROWS: ReadonlyArray<ProvenanceLegendRow> = Object.freeze(
  rowsFrom(PROVENANCE_CORE_ORDER),
);

/** Every state, decision-grade first, fail-closed + self-attested last. */
export const PROVENANCE_FULL_LEGEND_ROWS: ReadonlyArray<ProvenanceLegendRow> = Object.freeze(
  rowsFrom(PROVENANCE_ORDER),
);

export interface ProvenanceChipLegendProps {
  heading?: string;
  /** `'core'` (default) shows the six-register set; `'all'` shows every state;
   *  an array supplies a custom, ordered row set. */
  rows?: 'core' | 'all' | ReadonlyArray<ProvenanceLegendRow>;
  className?: string;
}

export function ProvenanceChipLegend({
  heading,
  rows = 'core',
  className,
}: ProvenanceChipLegendProps) {
  const resolved: ReadonlyArray<ProvenanceLegendRow> = Array.isArray(rows)
    ? rows
    : rows === 'all'
      ? PROVENANCE_FULL_LEGEND_ROWS
      : PROVENANCE_LEGEND_ROWS;

  return (
    <div className={cn('flex flex-col gap-3', className)} data-provenance-legend>
      {heading && (
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-muted,var(--vt-text-secondary))]">
          {heading}
        </div>
      )}
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {resolved.map((row) => (
          <li
            key={row.state}
            className="grid grid-cols-[minmax(180px,220px)_1fr] items-start gap-4"
          >
            {/*
              Every legend chip is illustrative by construction — these are
              vocabulary examples, not results about anyone. The `legend` form
              still renders the sample provenance line (that IS the legend's
              job) while announcing it as an example, so a screen-reader user
              cannot mistake a row for a real check on a real provider.
            */}
            <ProvenanceChip
              state={row.state}
              attribution={{
                legend: true,
                source: row.source,
                // Deliberately NOT `?? null`: several legend rows carry no
                // sample timestamp on purpose and explain themselves through
                // `detail` instead. `null` means "a source answered and the
                // as-of was not recorded" — a claim these rows do not make.
                asOf: row.timestamp,
                detail: row.detail,
              }}
            />
            <span className="text-[12.5px] leading-snug text-[var(--vt-text-secondary)]">
              {row.meaning ?? PROVENANCE_META[row.state].description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
