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

export const PASSPORT_SOURCE_COVERAGE_TITLE = 'Sources checked';
export const PASSPORT_SOURCE_COVERAGE_COPY =
  'Only checked sources are decision-grade. Pending, stale, review-required, access-required, preview-only, and not-decision-grade sources inform context but do not constitute primary-source verification.';

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
    <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none">
      <CardHeader className="border-b border-white/6 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          {PASSPORT_SOURCE_COVERAGE_TITLE}
        </p>
        <CardTitle className="text-sm font-semibold text-white/80">
          Trust-core coverage and contextual gaps
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed text-white/42">
          {PASSPORT_SOURCE_COVERAGE_COPY}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-2">
        {checks.map((check, index) => (
          <div
            key={check.sourceId}
            className={index === checks.length - 1 ? '' : 'border-b border-white/6'}
          >
            <SourceCoverageRow check={check} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default PassportSourceCoveragePanel;
