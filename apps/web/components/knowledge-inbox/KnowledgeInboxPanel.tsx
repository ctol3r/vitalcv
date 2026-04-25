import * as React from 'react';
import type { KnowledgeInboxItem } from '@/lib/knowledge-inbox/types';
import { FileText, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export function KnowledgeInboxPanel({ items }: { items: KnowledgeInboxItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
        <h3 className="text-sm font-semibold text-foreground/80">Knowledge Inbox is empty</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Add CV details, training history, research, or credential documents. 
          VitalCV will organize them, but source checks decide what is verified.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.itemId} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500">
                  {item.itemType}
                </span>
                <span className="text-xs text-muted-foreground">{item.confidence} confidence</span>
              </div>
              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
              {item.summary && <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>}
            </div>
            
            <div className="text-right flex flex-col items-end">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500">
                {item.provenance}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">{item.status}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Suggested Mapping</p>
              <div className="flex items-center gap-2 text-xs text-foreground/80">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.suggestedGraphNode}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{item.suggestedProfileSection}</span>
              </div>
            </div>
            
            {item.limitationNote && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Limitation
                </p>
                <p className="text-xs text-muted-foreground italic">{item.limitationNote}</p>
              </div>
            )}
          </div>

          {item.nextAction && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <p className="text-xs font-medium text-foreground/70">Next Step: {item.nextAction}</p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors">
                  Dismiss
                </button>
                <button className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Accept to Profile
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
