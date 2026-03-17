'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { IntelligenceSystemHealth } from '@/lib/intelligence/contracts';
import type { InvestigatorFindingEvidence } from '@/lib/intelligence/detail-types';
import { buildFindingEvidenceRows, summarizeFindingEvidenceRows } from '@/lib/intelligence/evidence';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { ConfidenceMeter, OpsBadge, OpsCard } from './primitives';
import { TrustSignalChips } from './trust-signal-chips';
import { Button, EvidenceTable } from '@/src/ui/components';

const DEFAULT_VISIBLE_ROWS = 5;

export function FindingEvidenceTable({
  evidence,
  confidence,
  health,
}: {
  evidence: InvestigatorFindingEvidence[];
  confidence: number;
  health: Pick<IntelligenceSystemHealth, 'sources'> | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(
    () => buildFindingEvidenceRows(evidence, confidence, health),
    [confidence, evidence, health],
  );
  const summary = useMemo(
    () => summarizeFindingEvidenceRows(rows, confidence),
    [confidence, rows],
  );
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_ROWS);
  const hiddenCount = Math.max(0, rows.length - DEFAULT_VISIBLE_ROWS);

  return (
    <OpsCard className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Evidence</h2>
          <p className="text-sm text-[var(--vt-text-3)]">
            {rows.length} record{rows.length === 1 ? '' : 's'} • {summary.uniqueSourceCount} source{summary.uniqueSourceCount === 1 ? '' : 's'}
          </p>
        </div>
        <span className="text-sm text-[var(--vt-text-3)]">{summary.corroborationCount} corroboration{summary.corroborationCount === 1 ? '' : 's'}</span>
      </div>

      <TrustSignalChips summary={summary} />

      {rows.length > 0 ? (
        <>
          <EvidenceTable
            columns={[
              {
                key: 'source',
                label: 'Source',
                render: (row) => (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {row.url ? (
                        <Link
                          href={row.url}
                          rel="noreferrer"
                          target="_blank"
                          className="font-medium text-[var(--vt-accent)] transition hover:opacity-80"
                        >
                          {row.sourceName}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--vt-text-secondary)]">{row.sourceName}</span>
                      )}
                      {row.degraded ? (
                        <span title="This source is currently degraded." className="inline-flex items-center text-[var(--vt-risk-medium)]">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <OpsBadge
                        label={row.sourceQuality.toLowerCase()}
                        tone={row.sourceQuality === 'AUTHORITATIVE' ? 'success' : row.sourceQuality === 'DERIVED' ? 'warning' : row.sourceQuality === 'MIXED' ? 'info' : 'neutral'}
                      />
                    </div>
                    <ConfidenceMeter confidence={row.confidence} />
                  </div>
                ),
              },
              {
                key: 'claim',
                label: 'Field / Value',
                render: (row) => (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--vt-text-3)]">{row.field}</p>
                    <div className="max-w-xl whitespace-pre-wrap break-words leading-6">
                      {row.value}
                    </div>
                  </div>
                ),
              },
              {
                key: 'retrieved',
                label: 'Retrieval',
                render: (row) => (
                  <div className="space-y-2">
                    <div className="text-sm text-[var(--vt-text-2)]">
                      {row.retrievedAt ? (
                        <>
                          <div title={formatAbsoluteTime(row.retrievedAt)}>
                            {formatRelativeTime(row.retrievedAt)}
                          </div>
                          <div className="text-xs text-[var(--vt-text-3)]">{formatAbsoluteTime(row.retrievedAt)}</div>
                        </>
                      ) : 'Not recorded'}
                    </div>
                    <OpsBadge
                      label={row.freshness.toLowerCase()}
                      tone={row.freshness === 'FRESH' ? 'success' : row.freshness === 'AGING' ? 'warning' : row.freshness === 'STALE' ? 'critical' : 'neutral'}
                    />
                  </div>
                ),
              },
              {
                key: 'trust',
                label: 'Trust Signals',
                render: (row) => (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <OpsBadge
                        label={row.qualityRating.toLowerCase()}
                        tone={row.qualityRating === 'STRONG' ? 'success' : row.qualityRating === 'ADEQUATE' ? 'info' : row.qualityRating === 'WEAK' ? 'warning' : 'neutral'}
                      />
                      <OpsBadge
                        label={`${row.corroborationCount} corroborations`}
                        tone={row.corroborationCount > 0 ? 'success' : 'neutral'}
                      />
                    </div>
                    <div className="max-w-sm text-xs leading-5 text-[var(--vt-text-3)]">
                      {row.provenanceChain.join(' -> ')}
                    </div>
                  </div>
                ),
              },
            ]}
            rows={visibleRows}
          />

          {hiddenCount > 0 ? (
            <Button
              onClick={() => setExpanded((current) => !current)}
              size="sm"
              variant="ghost"
            >
              {expanded ? 'Show fewer sources' : `Show ${hiddenCount} more sources`}
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--vt-text-3)]">Evidence pending — sources still corroborating</p>
      )}
    </OpsCard>
  );
}
