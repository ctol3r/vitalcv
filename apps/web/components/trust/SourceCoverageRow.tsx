import React from 'react';
import {
  getTrustStatusDescriptor,
  TrustStatusBadge,
  type TrustBadgeStatus,
} from '@/components/ui/trust-status-badge';
import { formatProofDate } from '@/lib/trust/proof-language';
import {
  sourceVisibilityBadgeLabel,
  type PassportVisibleSourceCoverageCheck,
} from '@/lib/trust/source-coverage';
import { mapSourceCoverageStateToTrustStatus } from '@/lib/trust/status-language';

void React;

interface SourceCoverageRowProps {
  check: PassportVisibleSourceCoverageCheck;
}

function resolveCoverageBadge(check: PassportVisibleSourceCoverageCheck): {
  status: TrustBadgeStatus;
  label: string;
} {
  if (check.state === 'reviewRequired') {
    return {
      status: 'review required',
      label: sourceVisibilityBadgeLabel(check.state),
    };
  }

  if (
    check.state === 'unavailable'
    || check.state === 'notDecisionGrade'
    || check.state === 'previewOnly'
  ) {
    return {
      status: 'unavailable',
      label: sourceVisibilityBadgeLabel(check.state),
    };
  }

  return {
    status: check.state === 'checked'
      ? 'checked'
      : mapSourceCoverageStateToTrustStatus(check.state),
    label: sourceVisibilityBadgeLabel(check.state),
  };
}

export function SourceCoverageRow({ check }: SourceCoverageRowProps) {
  const badge = resolveCoverageBadge(check);
  const statusDescriptor = getTrustStatusDescriptor(badge.status, badge.label);

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-white/72">{check.sourceLabel}</p>
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
