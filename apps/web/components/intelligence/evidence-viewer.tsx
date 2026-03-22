'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { FindingEvidenceRow } from '@/lib/intelligence/evidence';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OpsBadge, OpsCard } from '@/components/intelligence-ops/primitives';

function confidenceBar(confidence: number) {
  const pct = Math.round(confidence * 100);
  const bg = pct >= 80 ? 'bg-emerald-500' : pct >= 55 ? 'bg-amber-500' : 'bg-slate-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
        <div className={`h-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
    </div>
  );
}

export interface EvidenceViewerProps {
  rows: FindingEvidenceRow[];
}

export function EvidenceViewer({
  rows,
}: EvidenceViewerProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const sortedRows = useMemo(
    () => [...rows].sort((left, right) => {
      const leftTime = Date.parse(left.retrievedAt ?? '');
      const rightTime = Date.parse(right.retrievedAt ?? '');
      if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
        return 0;
      }
      if (Number.isNaN(leftTime)) {
        return 1;
      }
      if (Number.isNaN(rightTime)) {
        return -1;
      }
      return rightTime - leftTime;
    }),
    [rows],
  );

  function toggleRow(rowId: string) {
    setExpandedRows((previous) => {
      const next = { ...previous };
      if (next[rowId]) {
        delete next[rowId];
      } else {
        next[rowId] = true;
      }
      return next;
    });
  }

  if (sortedRows.length === 0) {
    return (
      <OpsCard className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Evidence</h2>
        <div className="space-y-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
          <p className="text-sm text-[var(--vt-text-2)]">
            No linked evidence is available for this scope yet.
          </p>
          <p className="text-sm text-[var(--vt-text-3)]">
            Next step: open the related finding or storyline and refresh this investigation after the evidence feed catches up.
          </p>
          <Link
            href="/intelligence?view=findings"
            className="inline-flex text-sm font-medium text-[var(--vt-accent)] transition hover:opacity-80"
          >
            Open findings feed
          </Link>
        </div>
      </OpsCard>
    );
  }

  return (
    <OpsCard className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Evidence</h2>
        <span className="text-xs text-[var(--vt-text-3)]">{sortedRows.length} linked</span>
      </div>

      {sortedRows.map((row) => {
        const isExpanded = Boolean(expandedRows[row.id]);
        const rowId = `evidence-${row.id}`;
        return (
          <div key={row.id} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => toggleRow(row.id)}
              aria-controls={rowId}
              aria-expanded={isExpanded}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--vt-text-1)]">{row.sourceName}</span>
                  <OpsBadge label={row.field} />
                </div>
                <p className={`text-sm text-[var(--vt-text-2)] ${isExpanded ? '' : 'line-clamp-1'}`}>{row.value}</p>
              </div>
              <span className="text-xs font-medium text-[var(--vt-text-3)]">
                {isExpanded ? 'Hide' : 'Expand'}
              </span>
            </button>

            {isExpanded ? (
              <div id={rowId} className="mt-3 space-y-3 border-t border-[var(--vt-border)] pt-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Value</p>
                  <p className="text-sm text-[var(--vt-text-2)]">{row.value}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Observed</p>
                  {row.retrievedAt ? (
                    <p className="text-sm text-[var(--vt-text-2)]" title={formatAbsoluteTime(row.retrievedAt)}>
                      {formatRelativeTime(row.retrievedAt)}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--vt-text-3)]">Timestamp unavailable</p>
                  )}
                </div>
                {row.url ? (
                  <Link
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-medium text-[var(--vt-accent)] transition hover:opacity-80"
                  >
                    Open evidence source
                  </Link>
                ) : null}
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Confidence</p>
                  {confidenceBar(row.confidence)}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </OpsCard>
  );
}
