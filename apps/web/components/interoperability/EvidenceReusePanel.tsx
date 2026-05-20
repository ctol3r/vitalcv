import * as React from 'react';
import { cn } from '@/lib/utils';
import type { EvidenceReuseRow } from '@/lib/interoperability/demoExchanges';

/**
 * Evidence Reuse panel.
 *
 * Demonstrates the operational benefit of a replay envelope: fewer
 * duplicate primary-source queries, fewer redundant phone calls,
 * shorter onboarding cycles. The panel NEVER claims automatic
 * acceptance, guaranteed credential reuse, or regulatory replacement.
 * Each row names a specific duplicate activity avoided and pairs it
 * with an institution-owned framing line.
 *
 * Rendered in zinc-500 footnote tone -- this is supporting evidence,
 * not the primary surface.
 */

export interface EvidenceReusePanelProps {
  rows: readonly EvidenceReuseRow[];
  className?: string;
}

export function EvidenceReusePanel({
  rows,
  className,
}: EvidenceReusePanelProps) {
  return (
    <section
      data-slot="evidence-reuse-panel"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-300 bg-slate-50',
        className,
      )}
    >
      <header className="border-b border-slate-300 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Evidence reuse · what the bundle replaces
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Replayable evidence reduces operational duplication. It does not
          constitute automatic acceptance or regulatory substitution. The
          receiving institution retains ownership of its own confirmations.
        </p>
      </header>
      <ul className="divide-y divide-slate-300">
        {rows.map((row, i) => (
          <li
            key={`${row.duplicateActivityAvoided}-${i}`}
            data-slot="evidence-reuse-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Duplicate activity avoided
              </div>
              <div className="mt-0.5 text-sm text-slate-900">
                {row.duplicateActivityAvoided}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Basis reference
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-900 break-all">
                {row.basisReference}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institutional framing
              </div>
              <div className="mt-0.5 text-xs text-slate-700">
                {row.institutionalNote}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
