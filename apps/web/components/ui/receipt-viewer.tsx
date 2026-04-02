import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ReceiptViewerProps extends React.ComponentPropsWithoutRef<'div'> {
  receiptId: string;
  sourceId: string;
  timestamp: string;
  payload: Record<string, unknown> | string;
}

/**
 * ReceiptViewer
 * 
 * Monospaced, highly structured viewer for the raw verification receipt,
 * proving the source artifact's authenticity and timestamp.
 * Adheres strictly to the black/white, minimal rule.
 */
export const ReceiptViewer = React.forwardRef<HTMLDivElement, ReceiptViewerProps>(
  ({ className, receiptId, sourceId, timestamp, payload, ...props }, ref) => {
    
    const formattedPayload = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload, null, 2);

    return (
      <div 
        ref={ref} 
        className={cn('flex flex-col border border-border rounded overflow-hidden font-mono bg-black text-foreground/80', className)}
        {...props}
      >
        <div className="flex flex-wrap text-[10px] sm:text-xs items-center justify-between border-b border-border bg-muted py-2 px-3">
          <div className="flex flex-col sm:flex-row sm:gap-4 gap-1">
            <span className="text-muted-foreground">RECEIPT_ID: <span className="text-foreground">{receiptId}</span></span>
            <span className="text-muted-foreground">SOURCE: <span className="text-foreground">{sourceId}</span></span>
          </div>
          <span className="text-muted-foreground">{timestamp}</span>
        </div>
        
        <ScrollArea className="h-48 sm:h-64 bg-black/50 p-3 sm:p-4 text-[11px] leading-relaxed">
          <pre className="whitespace-pre-wrap break-words">
            <code>{formattedPayload}</code>
          </pre>
        </ScrollArea>
        
        <div className="border-t border-border bg-white/[0.02] p-2 px-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold">
            Cryptographically Verified
          </span>
        </div>
      </div>
    );
  }
);

ReceiptViewer.displayName = 'ReceiptViewer';
