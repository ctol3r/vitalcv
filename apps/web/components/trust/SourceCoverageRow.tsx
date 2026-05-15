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
import { TrustTierBadgeFromCheck } from '@/components/proof/TrustTierBadge';

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
      status: 'checked',
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
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground/80">{check.sourceId}</p>
          <Badge
            variant="outline"
            className="rounded-full border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {decisionGrade ? 'Source-backed' : 'Waiting'}
          </Badge>
        </div>
        {statusDescriptor ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{statusDescriptor}</p>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">{check.reason}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{check.checkedAt ? `Checked ${formatProofDate(check.checkedAt)}` : 'Not yet checked'}</span>
          {check.artifactId ? <span>Artifact {check.artifactId}</span> : null}
        </div>
        {/* Trust tier badge — every fact must carry a tier */}
        <TrustTierBadgeFromCheck
          check={check}
          className="rounded-full border-border bg-background px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground"
        />
      </div>
      <TrustStatusBadge
        status={badge.status}
        label={badge.label}
        size="sm"
        className="shrink-0 self-start"
      />
    </div>
  );
}
