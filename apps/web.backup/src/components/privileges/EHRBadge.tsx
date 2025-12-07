'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EHRBadgeStatus = 'SYNCED' | 'FAILED' | 'DRIFT' | 'PENDING' | 'RETRYING';

interface EHRBadgeProps {
  status: EHRBadgeStatus;
  lastAttemptAt?: string | null;
  className?: string;
}

const STATUS_VARIANTS: Record<
  EHRBadgeStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
  }
> = {
  SYNCED: { label: 'Synced to EHR', icon: CheckCircle2, variant: 'default' },
  FAILED: { label: 'Sync failed', icon: AlertTriangle, variant: 'destructive' },
  DRIFT: { label: 'Drift detected', icon: AlertTriangle, variant: 'destructive' },
  PENDING: { label: 'Sync pending', icon: RefreshCcw, variant: 'secondary' },
  RETRYING: { label: 'Retrying', icon: RefreshCcw, variant: 'outline' },
};

export function EHRBadge({ status, lastAttemptAt, className }: EHRBadgeProps) {
  const config = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.PENDING;
  const Icon = config.icon;
  const tooltip = lastAttemptAt
    ? `Last attempt ${new Date(lastAttemptAt).toLocaleString()}`
    : 'No sync attempts recorded yet';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn('flex items-center gap-1', className)}
            variant={config.variant === 'default' ? 'default' : 'outline'}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-xs font-medium">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
