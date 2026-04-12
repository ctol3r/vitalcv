'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { PassportDivergence } from '@/lib/trust/passport-contract';

function severityBadgeClass(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  if (severity === 'HIGH') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  }
  if (severity === 'MEDIUM') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }
  return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
}

export function DivergenceSummaryCard({
  divergence,
  mode = 'passport',
}: {
  divergence?: PassportDivergence | null;
  mode?: 'passport' | 'review';
}) {
  if (!divergence || divergence.activeCount === 0) {
    return null;
  }

  const activeConflicts = divergence.conflicts.filter((conflict) => conflict.active);
  const highSeverity = divergence.highCount > 0;

  return (
    <Card
      className={[
        'gap-3 rounded-2xl px-5 py-4 shadow-none',
        highSeverity
          ? 'border-rose-500/20 bg-rose-500/6'
          : 'border-amber-500/20 bg-amber-500/6',
        mode === 'review' ? 'ring-1 ring-white/6' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {highSeverity ? (
              <AlertTriangle className="h-4 w-4 text-rose-200" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-100" />
            )}
            <p className="text-sm font-medium text-foreground/85">
              {highSeverity ? 'Cross-source divergence requires review' : 'Cross-source divergence detected'}
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {mode === 'review'
              ? 'VitalCV found conflicting source-backed facts. Treat this profile as review-required until the conflicts are resolved.'
              : 'VitalCV found conflicting source-backed facts. Resolve them to recover the CRS penalty and restore a cleaner readiness state.'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40">Active penalty</p>
          <p className="mt-1 text-sm font-semibold text-foreground/80">-{divergence.totalPenalty}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{divergence.activeCount} active conflict{divergence.activeCount === 1 ? '' : 's'}</span>
        {divergence.highCount > 0 ? <span>{divergence.highCount} high-severity</span> : null}
        {divergence.mediumCount > 0 ? <span>{divergence.mediumCount} medium-severity</span> : null}
        {divergence.lowCount > 0 ? <span>{divergence.lowCount} low-severity</span> : null}
      </div>

      <div className="space-y-2 border-t border-white/8 pt-3">
        {activeConflicts.slice(0, 3).map((conflict) => (
          <div key={conflict.id} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed text-foreground/78">{conflict.description}</p>
              <Badge variant="outline" className={severityBadgeClass(conflict.severity)}>
                {conflict.severity}
              </Badge>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {conflict.sources.join(' vs ')}{conflict.penalty > 0 ? ` · -${conflict.penalty} CRS` : ''}
            </p>
          </div>
        ))}
        {activeConflicts.length > 3 ? (
          <p className="text-[11px] text-muted-foreground">
            +{activeConflicts.length - 3} more divergence flag{activeConflicts.length - 3 === 1 ? '' : 's'} in this record.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
