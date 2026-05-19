import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tight key/value grid rendered inside any provenance pane.
 *
 * Single source of truth for the `dl > dt + dd` chrome that used to be
 * duplicated in every route-specific pane renderer. The grid is 2-col
 * by default; passing `cols={1}` collapses for narrow contexts.
 */
export interface ProvenancePaneMetaProps {
  entries: ReadonlyArray<{ label: string; value: string }>;
  cols?: 1 | 2;
  className?: string;
}

export function ProvenancePaneMeta({
  entries,
  cols = 2,
  className,
}: ProvenancePaneMetaProps) {
  return (
    <dl
      data-slot="provenance-pane-meta"
      className={cn(
        'grid gap-3 border-b border-slate-200 px-4 py-3 font-mono text-xs',
        cols === 1 ? 'grid-cols-1' : 'grid-cols-2',
        className,
      )}
    >
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {entry.label}
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-slate-900 break-all">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
