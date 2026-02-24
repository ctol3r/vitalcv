'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ReceiptOutcome = 'PASS' | 'FAIL' | 'PENDING';

export type ReceiptRow = {
  lane: string;
  subject: string;
  outcome: ReceiptOutcome;
  timestamp: string;
  hash: string;
};

/* ------------------------------------------------------------------ */
/*  Outcome visual config — strict: dots only, no icons                */
/* ------------------------------------------------------------------ */

const OUTCOME_CONFIG: Record<
  ReceiptOutcome,
  {
    dotColor: string;
    label: string;
    tooltip: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  PASS: {
    dotColor: 'bg-green-600',
    label: 'PASS',
    tooltip: 'Receipt recorded. Does not imply employer acceptance.',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-800',
    badgeBorder: 'border-green-200',
  },
  FAIL: {
    dotColor: 'bg-red-600',
    label: 'FAIL',
    tooltip: 'Receipt recorded. Blocks readiness until resolved.',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200',
  },
  PENDING: {
    dotColor: 'bg-gray-400',
    label: 'PENDING',
    tooltip: 'Check requested. Readiness unchanged.',
    badgeBg: 'bg-gray-50',
    badgeText: 'text-gray-600',
    badgeBorder: 'border-gray-200',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VerificationReceipts({
  receipts,
  crsUpdated = false,
  isUpdating = false,
}: {
  receipts: ReceiptRow[];
  crsUpdated?: boolean;
  isUpdating?: boolean;
}) {
  if (receipts.length === 0) {
    if (!isUpdating) return null;

    return (
      <Card interactive className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-800">Verification Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-muted/40 bg-muted/30 p-3 text-xs text-muted-foreground">
            Polling for receipt updates…
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasFail = receipts.some((r) => r.outcome === 'FAIL');

  return (
    <Card interactive className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-slate-800">Verification Receipts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* CRS updated banner */}
        {crsUpdated && (
          <div className="rounded-md bg-slate-100 border border-slate-200 p-3 flex items-start gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500 shrink-0 mt-1" />
            <p className="text-sm font-medium text-slate-700">
              CRS updated based on completed checks.
            </p>
          </div>
        )}

        {/* FAIL blocker banner */}
        {hasFail && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600 shrink-0 mt-1" />
            <p className="text-sm font-medium text-red-800">Failed verification present.</p>
          </div>
        )}

        {/* Receipts table */}
        <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Lane
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Outcome
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Recorded
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isUpdating && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-2.5 text-xs text-muted-foreground bg-slate-50/60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Updating receipts…
                    </span>
                  </td>
                </tr>
              )}
              {receipts.map((receipt, i) => {
                const config = OUTCOME_CONFIG[receipt.outcome];
                return (
                  <tr
                    key={`${receipt.lane}-${receipt.subject}-${i}`}
                    className={receipt.outcome === 'FAIL' ? 'bg-red-50/30' : 'bg-white'}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-700 uppercase text-xs tracking-wider">
                      {receipt.lane}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{receipt.subject}</td>
                    <td className="px-4 py-2.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Badge
                                className={`text-[11px] border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} hover:bg-transparent cursor-help`}
                              >
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${config.dotColor} mr-1.5`}
                                />
                                {config.label}
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-center">
                            <p>{config.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                      {new Date(receipt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-slate-500 font-mono">{receipt.hash}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
