import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClaimBadge } from '@/components/ui/claim-badge';
import type { ClaimLevel } from '@/components/trust-state/types';

export interface NodeDetailCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  title: string;
  subtitle?: string;
  claimLevel: ClaimLevel;
  statusText?: string;
  metadata?: Array<{ label: string; value: React.ReactNode }>;
}

/**
 * NodeDetailCard
 * 
 * Primary surface for rendering a node detail screen. Shows the core claim
 * (e.g., "Active License"), verification status, and metadata in a stark,
 * typography-driven layout following the trust-first doctrine.
 */
export const NodeDetailCard = React.forwardRef<HTMLDivElement, NodeDetailCardProps>(
  ({ className, title, subtitle, claimLevel, statusText, metadata, ...props }, ref) => {
    return (
      <Card 
        ref={ref} 
        className={cn('bg-black/40 border border-border backdrop-blur-md overflow-hidden', className)} 
        {...props}
      >
        <CardHeader className="border-b border-white/5 pb-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="text-xl tracking-tight text-white/90">
                {title}
              </CardTitle>
              {subtitle && (
                <CardDescription className="text-sm text-foreground/70">
                  {subtitle}
                </CardDescription>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ClaimBadge level={claimLevel} />
              {statusText && (
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  {statusText}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        
        {metadata && metadata.length > 0 && (
          <CardContent className="pt-4 pb-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {metadata.map((item, index) => (
                <div key={index} className="space-y-1">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                    {item.label}
                  </dt>
                  <dd className="text-sm text-foreground/80 font-medium break-words">
                    {item.value || <span className="text-muted-foreground/40">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        )}
      </Card>
    );
  }
);

NodeDetailCard.displayName = 'NodeDetailCard';
