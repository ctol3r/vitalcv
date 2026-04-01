import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SourceCoverageRow } from '@/components/trust/SourceCoverageRow';
import {
  buildPassportSourceVisibilityChecks,
  type PassportSourceCoverageCheck,
} from '@/lib/trust/source-coverage';

void React;

export const PASSPORT_SOURCE_COVERAGE_TITLE = 'Source visibility';
export const PASSPORT_SOURCE_COVERAGE_COPY =
  'VitalCV keeps NPPES, OIG, PECOS, and State Board coverage visible. Each row stays marked as checked, pending, access required, stale, needs review, or missing data.';

interface PassportSourceCoveragePanelProps {
  checks: PassportSourceCoverageCheck[];
}

export function PassportSourceCoveragePanel({
  checks,
}: PassportSourceCoveragePanelProps) {
  const visibleChecks = buildPassportSourceVisibilityChecks(checks);

  return (
    <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none">
      <CardHeader className="border-b border-white/6 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          {PASSPORT_SOURCE_COVERAGE_TITLE}
        </p>
        <CardTitle className="text-sm font-semibold text-white/80">
          Current source state
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed text-white/42">
          {PASSPORT_SOURCE_COVERAGE_COPY}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-2">
        {visibleChecks.map((check, index) => (
          <div
            key={check.sourceLabel}
            className={index === visibleChecks.length - 1 ? '' : 'border-b border-white/6'}
          >
            <SourceCoverageRow check={check} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default PassportSourceCoveragePanel;
