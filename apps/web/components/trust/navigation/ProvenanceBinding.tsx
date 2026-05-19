'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useStackedPanes } from '@/components/trust/StackedPaneLayout';
import {
  BINDING_RATIONALE_COPY,
  type BindingDirection,
  type BindingRationale,
} from '@/lib/trust/navigation-contract';
import type { PaneRef } from '@/lib/trust/panes';

/**
 * Single binding chip — one inbound or forward link from a pane to
 * another pane.
 *
 * - `direction = 'inbound'` is the cryptographic-visibility direction
 *   (rendered with a left-pointing arrow). LineageBacklinks rows must
 *   use this direction.
 * - `direction = 'forward'` is a navigational shortcut (rendered with
 *   a right-pointing arrow) — "open bound receipt", "open lineage".
 */
export interface ProvenanceBindingProps {
  target: PaneRef;
  /** Human-readable label rendered as the binding's primary line. */
  label: string;
  /** Either a canonical rationale token (gets canonical copy) or free-form text. */
  rationale?: BindingRationale | string;
  direction: BindingDirection;
  className?: string;
}

function resolveRationaleCopy(
  rationale: ProvenanceBindingProps['rationale'],
): string | undefined {
  if (!rationale) return undefined;
  if ((Object.keys(BINDING_RATIONALE_COPY) as readonly string[]).includes(rationale)) {
    return BINDING_RATIONALE_COPY[rationale as BindingRationale];
  }
  return rationale;
}

export function ProvenanceBinding({
  target,
  label,
  rationale,
  direction,
  className,
}: ProvenanceBindingProps) {
  const { open } = useStackedPanes();
  const arrow = direction === 'inbound' ? '←' : '→';
  const rationaleCopy = resolveRationaleCopy(rationale);
  return (
    <button
      type="button"
      data-slot="provenance-binding"
      data-direction={direction}
      data-target-kind={target.kind}
      data-target-id={target.id}
      onClick={() => open(target)}
      className={cn(
        'flex w-full items-start gap-2 border border-slate-900 bg-white px-2 py-1.5 text-left font-mono text-xs hover:bg-slate-50',
        className,
      )}
    >
      {direction === 'inbound' ? (
        <span className="shrink-0 text-slate-500">{arrow}</span>
      ) : null}
      <span className="inline-flex shrink-0 items-center border border-slate-900 bg-slate-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-50">
        {target.kind}
      </span>
      <span className="flex-1 break-all text-slate-900">
        {label}
        {rationaleCopy ? (
          <span className="block text-[10px] text-slate-500">
            {rationaleCopy}
          </span>
        ) : null}
      </span>
      {direction === 'forward' ? (
        <span className="shrink-0 text-slate-500">{arrow}</span>
      ) : null}
    </button>
  );
}
