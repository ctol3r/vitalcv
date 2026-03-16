'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { IntelligenceSystemHealth } from '@/lib/intelligence/contracts';
import type { InvestigatorFindingEvidence } from '@/lib/intelligence/detail-types';
import { buildFindingEvidenceRows } from '@/lib/intelligence/evidence';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { ConfidenceMeter, OpsCard } from './primitives';

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
        <h2 className="text-lg font-semibold text-white">Evidence</h2>
        <span className="text-sm text-slate-400">{rows.length} sources</span>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Source</th>
                  <th className="pb-3 pr-4 font-medium">Field</th>
                  <th className="pb-3 pr-4 font-medium">Value</th>
                  <th className="pb-3 font-medium">Retrieved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-3 pr-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {row.url ? (
                            <Link
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-cyan-200 transition hover:text-cyan-100"
                            >
                              {row.sourceName}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-200">{row.sourceName}</span>
                          )}
                          {row.degraded ? (
                            <span title="This source is currently degraded." className="inline-flex items-center text-amber-200">
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                          ) : null}
                        </div>
                        <ConfidenceMeter confidence={row.confidence} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{row.field}</td>
                    <td className="py-3 pr-4 text-slate-300">
                      <div className="max-w-xl whitespace-pre-wrap break-words leading-6">
                        {row.value}
                      </div>
                    </td>
                    <td className="py-3 text-slate-400">
                      {row.retrievedAt ? (
                        <span title={formatAbsoluteTime(row.retrievedAt)}>
                          {formatRelativeTime(row.retrievedAt)}
                        </span>
                      ) : 'Not recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="text-sm text-cyan-200 transition hover:text-cyan-100"
            >
              {expanded ? 'Show fewer sources' : `Show ${hiddenCount} more sources`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-400">Evidence pending — sources still corroborating</p>
      )}
    </OpsCard>
  );
}
