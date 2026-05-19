'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useStackedPanes } from './StackedPaneLayout';
import type { PaneRef } from '@/lib/trust/panes';

/**
 * Lineage Backlinks — bi-directional cryptographic visibility.
 *
 * Inspired by the Matuschak notes pattern: whenever you open a pane,
 * the deeper context shows every other artifact that points TO this
 * one. Opening an audit event reveals the entity it is bound to;
 * opening a claim reveals the receipts that signed it; opening a
 * receipt reveals every audit row that consumed it.
 *
 * This is presentation-only — backlink resolution is a caller policy
 * (the caller passes the resolved links). Keeping resolution out of
 * the component avoids embedding fetch behavior in a primitive and
 * lets server callers pre-resolve for offline-verifiable pages.
 */

export interface LineageBacklinkEntry {
  /** The pane that links TO the current pane. */
  ref: PaneRef;
  /** Human-readable label rendered for the backlink chip. */
  label: string;
  /** Optional short rationale (e.g. "signed this claim", "audit row consumed"). */
  rationale?: string;
}

export interface LineageBacklinksProps {
  /** Title rendered above the chip rail (e.g. "Bi-directional bindings"). */
  title?: string;
  /** Backlinks the caller has pre-resolved for this pane. */
  links: readonly LineageBacklinkEntry[];
  className?: string;
}

export function LineageBacklinks({
  title = 'Lineage backlinks · bi-directional bindings',
  links,
  className,
}: LineageBacklinksProps) {
  const { open } = useStackedPanes();

  if (links.length === 0) {
    return (
      <section
        data-slot="lineage-backlinks"
        data-empty="true"
        className={cn(
          'border-t border-slate-900 bg-white px-4 py-3 font-mono text-[11px] text-slate-500',
          className,
        )}
      >
        <div className="uppercase tracking-wider opacity-70">{title}</div>
        <div className="mt-2">No artifacts bind to this pane.</div>
      </section>
    );
  }

  return (
    <section
      data-slot="lineage-backlinks"
      className={cn(
        'border-t border-slate-900 bg-white px-4 py-3',
        className,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {links.map((entry, i) => (
          <li key={`${entry.ref.kind}-${entry.ref.id}-${i}`}>
            <button
              type="button"
              onClick={() => open(entry.ref)}
              data-slot="lineage-backlink"
              data-target-kind={entry.ref.kind}
              data-target-id={entry.ref.id}
              className={cn(
                'flex w-full items-start gap-2 border border-slate-900 bg-white px-2 py-1.5 text-left font-mono text-xs hover:bg-slate-50',
              )}
            >
              <span className="inline-flex shrink-0 items-center border border-slate-900 bg-slate-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-50">
                {entry.ref.kind}
              </span>
              <span className="flex-1 break-all text-slate-900">
                {entry.label}
                {entry.rationale ? (
                  <span className="block text-[10px] text-slate-500">
                    {entry.rationale}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-slate-500">→</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
