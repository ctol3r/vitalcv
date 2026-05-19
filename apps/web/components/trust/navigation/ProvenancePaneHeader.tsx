import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  PROVENANCE_PANE_DESCRIPTIONS,
  type ProvenancePaneCategory,
} from '@/lib/trust/navigation-contract';

/**
 * Canonical header for any provenance pane.
 *
 * Replaces the inline header in route-specific pane renderers so that
 * every pane in every surface shows the same `<category> · <state>`
 * caption rail and identical close affordance. The chrome is dense
 * and institutional — no shadows, no icons, no animation.
 */
export interface ProvenancePaneHeaderProps {
  category: ProvenancePaneCategory;
  /** Short title — typically the pane id (e.g. receipt hash, run id). */
  title: string;
  /**
   * Optional caption suffix appended after the category name, e.g.
   * "active" / "in stack" / "pending anchor".
   */
  captionSuffix?: string;
  /** Close handler. When omitted, the close affordance is hidden. */
  onClose?: () => void;
  className?: string;
}

export function ProvenancePaneHeader({
  category,
  title,
  captionSuffix,
  onClose,
  className,
}: ProvenancePaneHeaderProps) {
  const caption = captionSuffix
    ? `${category} · ${captionSuffix}`
    : category;
  return (
    <header
      data-slot="provenance-pane-header"
      data-category={category}
      className={cn(
        'border-b border-slate-900 bg-slate-100 px-4 py-2',
        className,
      )}
    >
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-slate-700">
        <span>{caption}</span>
        {onClose ? (
          <button
            type="button"
            aria-label="Close pane"
            onClick={onClose}
            className="text-slate-700 hover:text-slate-900"
          >
            ×
          </button>
        ) : null}
      </div>
      <div
        title={PROVENANCE_PANE_DESCRIPTIONS[category]}
        className="mt-1 font-mono text-sm break-all text-slate-900"
      >
        {title}
      </div>
    </header>
  );
}
