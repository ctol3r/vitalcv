'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, Info } from 'lucide-react';

export interface CompactRuleSummary {
  compactType: string;
  eligible: boolean;
  reason: string;
  conditions: Array<{
    code: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface CompactEligibleChipProps {
  summary: CompactRuleSummary;
  className?: string;
}

export function CompactEligibleChip({ summary, className }: CompactEligibleChipProps) {
  const { eligible, reason, conditions, compactType } = summary;

  if (!eligible) {
    return (
      <Badge variant="outline" className={className}>
        <Info className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Compact review needed
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Badge className={className}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Compact eligible
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-2">
          <div>
            <p className="text-xs font-semibold">{compactType}</p>
            <p className="text-xs text-muted-foreground">{reason}</p>
          </div>
          <ul className="space-y-1 text-xs">
            {conditions.slice(0, 3).map((condition) => (
              <li key={condition.code} className="flex items-start gap-1">
                <CheckCircle2
                  className="h-3 w-3 text-emerald-500"
                  aria-hidden="true"
                />
                <span>{condition.detail}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

