import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SourceCoverageRow } from '@/components/trust/SourceCoverageRow';
import type { PassportSourceCoverageCheck } from '@/lib/trust/source-coverage';

void React;

export const PASSPORT_SOURCE_COVERAGE_TITLE = 'Source coverage';
export const PASSPORT_SOURCE_COVERAGE_COPY =
  'Source-backed items appear first. Open states show what is still waiting, stale, or access-gated.';

interface PassportSourceCoveragePanelProps {
  checks: PassportSourceCoverageCheck[];
}

export function PassportSourceCoveragePanel({
  checks,
}: PassportSourceCoveragePanelProps) {
  if (checks.length === 0) {
    return null;
  }

  return (
    <Card className="gap-0 rounded-2xl border-border bg-card py-0 shadow-none">
      <CardHeader className="border-b border-border px-5 py-5">
        <p className="text-xs font-medium text-muted-foreground">
          {PASSPORT_SOURCE_COVERAGE_TITLE}
        </p>
        <CardTitle className="text-base font-semibold text-foreground/85">
          Source-backed signals, ordered by importance
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed text-muted-foreground">
          {PASSPORT_SOURCE_COVERAGE_COPY}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-2">
        {checks.map((check, index) => (
          <div
            key={check.sourceId}
            className={index === checks.length - 1 ? '' : 'border-b border-border'}
          >
            <SourceCoverageRow check={check} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default PassportSourceCoveragePanel;
