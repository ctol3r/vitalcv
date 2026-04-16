'use client';

import { Card } from '@/components/ui/card';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import type { IngestStreamState } from '@/hooks/useIngestStream';

/**
 * AcceptanceCard — passport surface, flat + token-driven.
 *
 * Shows per-org acceptance state derived from the current surface state.
 * TODO(api): replace derived rows with real /api/acceptances/:entityId data
 * once the acceptances repo is exposed to the web app.
 */

interface AcceptanceRow {
  org: string;
  status: TrustBadgeStatus;
  label: string;
}

function deriveAcceptance(state: IngestStreamState): AcceptanceRow[] {
  const ready = state.readiness.status === 'READY';
  const partial = state.readiness.status === 'PARTIAL';

  const baseStatus: TrustBadgeStatus = ready ? 'verified' : partial ? 'access_required' : 'pending';
  const baseLabel = ready ? 'Accepted' : partial ? 'Review' : 'Pending';

  return [
    { org: 'Medicare (CMS)',         status: baseStatus,      label: baseLabel },
    { org: 'State Board',            status: 'access_required', label: 'Access required' },
    { org: 'Employer network',       status: baseStatus,      label: baseLabel },
  ];
}

export function AcceptanceCard({ state }: { state: IngestStreamState }) {
  const rows = deriveAcceptance(state);
  const acceptedCount = rows.filter((r) => r.status === 'verified').length;

  return (
    <Card className="animate-trust-panel-enter gap-0 rounded-xl border border-[var(--vt-border)] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground/60 text-xs uppercase tracking-widest">
          Acceptance
        </span>
        <span className="text-foreground/80 text-sm tabular-nums">
          {acceptedCount}/{rows.length} accepted
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div
            key={row.org}
            className="flex items-center justify-between py-1 border-b border-[var(--vt-border)] last:border-0"
          >
            <span className="text-foreground/70 text-sm">{row.org}</span>
            <TrustStatusBadge status={row.status} label={row.label} size="sm" />
          </div>
        ))}
      </div>
    </Card>
  );
}
