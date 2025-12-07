'use client';

import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

type ReadinessState = 'ready' | 'partial' | 'blocked';

interface ReadinessIndicatorProps {
  state: ReadinessState;
  label?: string;
  blockedReasons?: string[];
  ariaDescription?: string;
}

const STATE_CONFIG: Record<
  ReadinessState,
  {
    icon: typeof CheckCircle2;
    tone: string;
    label: string;
    badgeVariant: 'default' | 'secondary' | 'destructive';
  }
> = {
  ready: {
    icon: CheckCircle2,
    tone: 'text-emerald-600',
    label: 'Ready',
    badgeVariant: 'default',
  },
  partial: {
    icon: MinusCircle,
    tone: 'text-amber-600',
    label: 'Partial',
    badgeVariant: 'secondary',
  },
  blocked: {
    icon: XCircle,
    tone: 'text-red-600',
    label: 'Blocked',
    badgeVariant: 'destructive',
  },
};

export function ReadinessIndicator({
  state,
  label,
  blockedReasons = [],
  ariaDescription,
}: ReadinessIndicatorProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  const hasBlocked = blockedReasons.length > 0;

  const content = (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors',
        {
          'border-emerald-200 bg-emerald-50': state === 'ready',
          'border-amber-200 bg-amber-50': state === 'partial',
          'border-red-200 bg-red-50': state === 'blocked',
        },
      )}
      aria-live="polite"
    >
      <Icon className={cn('h-4 w-4', config.tone)} aria-hidden="true" />
      <span className="text-sm font-medium">
        {label ?? config.label}
        {state !== 'ready' && hasBlocked ? ` (${blockedReasons.length} blocker${blockedReasons.length > 1 ? 's' : ''})` : ''}
      </span>
    </div>
  );

  if (!hasBlocked) {
    return (
      <div className="flex items-center gap-2">
        {content}
        <Badge variant={config.badgeVariant} className="text-xs uppercase tracking-tight">
          {config.label}
        </Badge>
        {ariaDescription && <span className="sr-only">{ariaDescription}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left">
          <p className="font-semibold">Blocked prerequisites</p>
          <ul className="mt-1 list-disc pl-4 text-[13px] leading-relaxed">
            {blockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
      <Badge variant={config.badgeVariant} className="text-xs uppercase tracking-tight">
        {config.label}
      </Badge>
      {ariaDescription && <span className="sr-only">{ariaDescription}</span>}
    </div>
  );
}

export type { ReadinessIndicatorProps, ReadinessState };


