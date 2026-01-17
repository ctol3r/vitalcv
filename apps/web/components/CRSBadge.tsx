import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface CRSBadgeProps {
  score: number;
  className?: string;
}

export function CRSBadge({ score, className }: CRSBadgeProps) {
  const normalizedScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  let colorClass = 'bg-red-500 hover:bg-red-600';
  let Icon = ShieldX;
  let label = 'Low Trust';

  if (normalizedScore >= 80) {
    colorClass = 'bg-green-500 hover:bg-green-600';
    Icon = ShieldCheck;
    label = 'High Trust';
  } else if (normalizedScore >= 50) {
    colorClass = 'bg-yellow-500 hover:bg-yellow-600';
    Icon = ShieldAlert;
    label = 'Medium Trust';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('gap-1 pr-2', colorClass, className)}>
            <Icon className="h-3 w-3" />
            <span>CRS: {normalizedScore}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Credential Readiness Score: {normalizedScore}/100</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
