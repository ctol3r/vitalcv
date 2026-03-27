import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  getTrustStatusDescriptor,
  TrustStatusBadge,
  type TrustBadgeStatus,
} from '@/components/ui/trust-status-badge';
import { formatProofDate } from '@/lib/trust/proof-language';
import {
  sourceCoverageBadgeLabel,
  type PassportSourceCoverageCheck,
} from '@/lib/trust/source-coverage';
import { mapSourceCoverageStateToTrustStatus } from '@/lib/trust/status-language';

void React;

interface SourceCoverageRowProps {
  check: PassportSourceCoverageCheck;
}

function resolveCoverageBadge(check: PassportSourceCoverageCheck): {
  status: TrustBadgeStatus;
  label: string;
} {
  if (check.state === 'checked') {
    return {
      status: 'verified',
      label: sourceCoverageBadgeLabel({
        state: check.state,
        decisionGrade: true,
      }),
    };
  }

  return {
    status: mapSourceCoverageStateToTrustStatus(check.state),
    label: sourceCoverageBadgeLabel({
      state: check.state,
      decisionGrade: false,
    }),
  };
}

export function SourceCoverageRow({ check }: SourceCoverageRowProps) {
  const decisionGrade = check.state === 'checked';
  const badge = resolveCoverageBadge(check);
  const statusDescriptor = getTrustStatusDescriptor(badge.status, badge.label);

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white/72">{check.sourceId}</p>
          <Badge
            variant="outline"
            className="rounded-full border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35"
          >
            {decisionGrade ? 'Decision grade' : 'Not decision grade'}
          </Badge>
        </div>
        {statusDescriptor ? (
          <p className="text-[11px] leading-relaxed text-white/28">{statusDescriptor}</p>
        ) : null}
        <p className="text-xs leading-relaxed text-white/42">{check.reason}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/24">
          <span>{check.checkedAt ? `Checked ${formatProofDate(check.checkedAt)}` : 'Not yet checked'}</span>
          {check.artifactId ? <span>Artifact {check.artifactId}</span> : null}
        </div>
      </div>
      <TrustStatusBadge
        status={badge.status}
        label={badge.label}
        size="sm"
        className="shrink-0"
      />
    </div>
  );
}
