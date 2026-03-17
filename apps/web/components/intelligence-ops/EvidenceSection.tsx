'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { IntelligenceSystemHealth } from '@/lib/intelligence/contracts';
import type { InvestigatorFindingEvidence } from '@/lib/intelligence/detail-types';
import {
  buildFindingEvidenceRows,
  type FindingEvidenceRow,
  summarizeFindingEvidenceRows,
} from '@/lib/intelligence/evidence';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import type { TrustSignalSummary } from '@/lib/intelligence/trust-signals';
import { OpsBadge, OpsCard } from './primitives';

const QUALITY_OPTIONS = ['STRONG', 'ADEQUATE', 'WEAK', 'MISSING'] as const;

export function EvidenceSection({
  rows,
  summary,
  evidence,
  confidence,
  health,
}: {
  rows?: FindingEvidenceRow[];
  summary?: TrustSignalSummary;
  evidence?: InvestigatorFindingEvidence[];
  confidence?: number;
  health?: Pick<IntelligenceSystemHealth, 'sources'> | null | undefined;
}) {
  const resolvedRows = useMemo(
    () => rows ?? buildFindingEvidenceRows(evidence ?? [], confidence ?? 0, health),
    [confidence, evidence, health, rows],
  );
  const resolvedSummary = useMemo(
    () => summary ?? summarizeFindingEvidenceRows(resolvedRows, confidence ?? 0),
    [confidence, resolvedRows, summary],
  );
  const [qualitySelections, setQualitySelections] = useState<Record<string, string>>({});

  return (
    <OpsCard className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Evidence</h2>
          <p className="text-sm text-[var(--vt-text-3)]">
            {resolvedRows.length} evidence record{resolvedRows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OpsBadge label={`${resolvedRows.length} linked`} />
          <OpsBadge label={`${resolvedSummary.uniqueSourceCount} sources`} />
        </div>
      </div>

      {resolvedRows.length === 0 ? (
        <p className="text-sm text-[var(--vt-text-3)]">No evidence has been linked to this finding yet.</p>
      ) : (
        <div className="space-y-3">
          {resolvedRows.map((row) => {
            const selectedQuality = qualitySelections[row.id] ?? row.qualityRating;

            return (
              <div
                key={row.id}
                className="grid gap-3 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_12rem]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.url ? (
                      <Link
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-[var(--vt-accent)] transition hover:opacity-80"
                      >
                        {row.sourceName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--vt-text-1)]">{row.sourceName}</span>
                    )}
                    <OpsBadge label={row.field} />
                    <OpsBadge label={selectedQuality} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Value</p>
                    <p className="text-sm leading-6 text-[var(--vt-text-2)]">{row.value}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-[var(--vt-text-3)]">
                    <span title={row.retrievedAt ? formatAbsoluteTime(row.retrievedAt) : undefined}>
                      {row.retrievedAt ? `Observed ${formatRelativeTime(row.retrievedAt)}` : 'Timestamp unavailable'}
                    </span>
                    <span>{row.corroborationCount} corroboration{row.corroborationCount === 1 ? '' : 's'}</span>
                    <span>{row.provenanceChain.join(' -> ')}</span>
                  </div>
                </div>

                <label className="space-y-2 text-sm">
                  <span className="text-[var(--vt-text-3)]">Evidence quality</span>
                  <select
                    value={selectedQuality}
                    onChange={(event) => setQualitySelections((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))}
                    className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-2 text-[var(--vt-text-1)]"
                  >
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </OpsCard>
  );
}
