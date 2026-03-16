'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { IntelligenceSystemHealth } from '@/lib/intelligence/contracts';
import type { InvestigatorFindingEvidence } from '@/lib/intelligence/detail-types';
import { buildFindingEvidenceRows } from '@/lib/intelligence/evidence';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { ConfidenceMeter, OpsCard } from './primitives';
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
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_ROWS);
  const hiddenCount = Math.max(0, rows.length - DEFAULT_VISIBLE_ROWS);

  return (
    <OpsCard className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Evidence</h2>
        <span className="text-sm text-[var(--vt-text-3)]">{rows.length} sources</span>
      </div>

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
                    <ConfidenceMeter confidence={row.confidence} />
                  </div>
                ),
              },
              {
                key: 'field',
                label: 'Field',
                render: (row) => row.field,
              },
              {
                key: 'value',
                label: 'Value',
                render: (row) => (
                  <div className="max-w-xl whitespace-pre-wrap break-words leading-6">
                    {row.value}
                  </div>
                ),
              },
              {
                key: 'retrieved',
                label: 'Retrieved',
                render: (row) => (
                  row.retrievedAt ? (
                    <span title={formatAbsoluteTime(row.retrievedAt)}>
                      {formatRelativeTime(row.retrievedAt)}
                    </span>
                  ) : 'Not recorded'
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
