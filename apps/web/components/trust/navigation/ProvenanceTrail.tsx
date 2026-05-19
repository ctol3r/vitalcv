'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useStackedPanes } from '@/components/trust/StackedPaneLayout';
import {
  MAX_PANE_DEPTH,
  PROVENANCE_PANE_DESCRIPTIONS,
  type ProvenancePaneCategory,
} from '@/lib/trust/navigation-contract';
import type { PaneRef } from '@/lib/trust/panes';

/**
 * Stack-depth breadcrumb for the Stacked Provenance Ledger.
 *
 * Renders the active pane stack as a dense, scrollable trail with one
 * chip per pane. Clicking a chip truncates the stack to that pane
 * (closes everything to its right). When the stack reaches
 * MAX_PANE_DEPTH, an ellipsis chip surfaces a "truncated" affordance
 * — the leading panes have been dropped from the URL on the previous
 * push but the breadcrumb still names the truncation so the user is
 * never silently surprised.
 *
 * Caller policy: render this above or below the pane stack — never
 * inside an individual pane.
 */
export interface ProvenanceTrailProps {
  /** Optional explicit root pane (e.g. the route-owned receipt). */
  rootPane?: PaneRef;
  /**
   * If the route enforced a truncation on the most recent push, the
   * count of dropped panes is shown as an ellipsis chip on the left.
   */
  truncatedCount?: number;
  className?: string;
}

export function ProvenanceTrail({
  rootPane,
  truncatedCount = 0,
  className,
}: ProvenanceTrailProps) {
  const { panes, closeAt } = useStackedPanes();
  const totalDisplay = (rootPane ? 1 : 0) + panes.length;
  return (
    <nav
      aria-label="Provenance trail"
      data-slot="provenance-trail"
      data-depth={totalDisplay}
      data-max-depth={MAX_PANE_DEPTH}
      className={cn(
        'flex items-center gap-1 overflow-x-auto border-b border-slate-900 bg-slate-50 px-3 py-1.5 font-mono text-[10px]',
        className,
      )}
    >
      <span className="shrink-0 uppercase tracking-wider text-slate-500">
        trail
      </span>
      {truncatedCount > 0 ? (
        <span
          data-slot="provenance-trail-truncation"
          className="inline-flex shrink-0 items-center border border-dashed border-slate-400 bg-white px-1.5 py-0.5 text-slate-500"
          title={`${truncatedCount} pane(s) truncated to honor MAX_PANE_DEPTH=${MAX_PANE_DEPTH}`}
        >
          … +{truncatedCount}
        </span>
      ) : null}
      {rootPane ? (
        <TrailChip
          ref_={rootPane}
          isRoot
          onActivate={undefined}
        />
      ) : null}
      {panes.map((ref, i) => (
        <React.Fragment key={`${ref.kind}-${ref.id}-${i}`}>
          <span aria-hidden="true" className="text-slate-400">
            ›
          </span>
          <TrailChip
            ref_={ref}
            onActivate={() => closeAt(i + 1)}
          />
        </React.Fragment>
      ))}
    </nav>
  );
}

function TrailChip({
  ref_,
  isRoot,
  onActivate,
}: {
  ref_: PaneRef;
  isRoot?: boolean;
  onActivate?: () => void;
}) {
  const category = ref_.kind as ProvenancePaneCategory;
  const title = PROVENANCE_PANE_DESCRIPTIONS[category];
  const body = (
    <>
      <span className="inline-flex items-center border border-slate-900 bg-slate-900 px-1 py-px text-[9px] uppercase tracking-wider text-slate-50">
        {ref_.kind}
      </span>
      <span className="ml-1 truncate text-slate-700">{ref_.id}</span>
    </>
  );
  const className =
    'inline-flex max-w-[12rem] shrink-0 items-center border border-slate-900 bg-white px-1.5 py-0.5 hover:bg-slate-100';
  if (isRoot || !onActivate) {
    return (
      <span title={title} className={className}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onActivate}
      className={className}
    >
      {body}
    </button>
  );
}
