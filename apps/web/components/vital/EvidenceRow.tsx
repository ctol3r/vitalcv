import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { type EvidenceState } from '@/lib/vital/evidenceState';
import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';

/**
 * EvidenceRow — one claim rendered with its full honest context: the claim, the
 * value returned, its state, the source + when it was checked, what it means,
 * what it does NOT mean, and (optionally) the one action that would advance it.
 * The single row shape used across readiness, Wallet, Passport, and review.
 *
 * The timestamp carries `data-ts` + a <time datetime> so visual-regression can
 * mask it (freshness text is dynamic; layout is not).
 */
export interface EvidenceRowData {
  claim: string;
  value?: string;
  state: EvidenceState;
  source?: string;
  /** Human freshness string, e.g. "Jul 15, 2026 · 2:18 PM PT". */
  checkedAt?: string;
  /** Machine value for <time datetime> (ISO), optional. */
  checkedAtISO?: string;
  meaning?: string;
  limitation?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EvidenceRow({ data, className }: { data: EvidenceRowData; className?: string }) {
  const { claim, value, state, source, checkedAt, checkedAtISO, meaning, limitation, action } = data;
  // W1082: the chip demands attribution. A row that names its source passes it
  // through (asOf: null when the row has a source but no timestamp — announced
  // as "as-of not recorded", never invented). A row without a source falls to
  // 'declared', which announces the state's own meaning and names nobody.
  const attribution = source
    ? { source, asOf: checkedAt ?? null, asOfISO: checkedAtISO }
    : ('declared' as const);
  return (
    <div className={`border-b border-[var(--vt-border-subtle,var(--vt-border))] py-3.5 last:border-b-0 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">{claim}</p>
          {value && <p className="mt-0.5 text-[13px] text-[var(--vt-text-secondary)]">{value}</p>}
        </div>
        <StateChip state={state} attribution={attribution} size="sm" className="mt-0.5 shrink-0" />
      </div>

      {(source || checkedAt) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--vt-text-muted)]">
          {source && <span>{source}</span>}
          {source && checkedAt && <span aria-hidden="true">·</span>}
          {checkedAt && (
            <time data-ts="" dateTime={checkedAtISO} className="font-mono">
              {checkedAt}
            </time>
          )}
        </p>
      )}

      {meaning && <p className="mt-2 text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">{meaning}</p>}
      {limitation && (
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
          <span className="font-semibold">Does not mean:</span> {limitation}
        </p>
      )}

      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
          >
            {action.label}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
          >
            {action.label}
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        ))}
    </div>
  );
}

export default EvidenceRow;
