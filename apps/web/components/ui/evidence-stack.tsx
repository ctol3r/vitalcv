import * as React from 'react';
import { cn } from '@/lib/utils';
import { TrustLabel, type TrustStatus } from '@/components/ui/trust-label';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface EvidenceItem {
  id: string;
  status: TrustStatus;
  label: string;
  source?: string;
  timestamp?: string;
  note?: string;
  explanation?: string;
}

export interface EvidenceStackProps extends React.ComponentPropsWithoutRef<'div'> {
  items: EvidenceItem[];
  maxHeight?: string | number;
}

/**
 * EvidenceStack
 * 
 * Container for rendering ordered verification data.
 * Displays hierarchy from highest-confidence proof to lowest.
 */
export const EvidenceStack = React.forwardRef<HTMLDivElement, EvidenceStackProps>(
  ({ className, items, maxHeight = 400, ...props }, ref) => {
    // Optional sorting: confirmed > review > unchecked > info > blocked,
    // assuming they come pre-sorted from the backend mostly, but we just render.

    return (
      <div
        ref={ref}
        className={cn('flex flex-col border border-[var(--vt-border)] rounded-2xl bg-[var(--vt-surface)] overflow-hidden', className)}
        {...props}
      >
        <div className="px-4 py-3 border-b border-[var(--vt-border)] bg-[var(--vt-surface-subtle)]">
          <h4 className="text-xs uppercase tracking-widest text-foreground/70 font-semibold">Evidence Log</h4>
        </div>
        <ScrollArea 
          style={{ maxHeight }} 
          className="p-4"
        >
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground/60 italic">
              No evidence available.
            </div>
          ) : (
            <div className="flex flex-col gap-3 relative before:absolute before:inset-y-4 before:left-[22px] before:w-[1px] before:bg-muted">
              {items.map((item) => (
                <div key={item.id} className="relative z-10">
                  <TrustLabel
                    status={item.status}
                    label={item.label}
                    source={item.source}
                    timestamp={item.timestamp}
                    note={item.note}
                    explanation={item.explanation}
                    className="shadow-md bg-[var(--vt-surface-subtle)] border-border"
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }
);

EvidenceStack.displayName = 'EvidenceStack';
