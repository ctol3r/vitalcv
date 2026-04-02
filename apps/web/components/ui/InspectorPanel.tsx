'use client';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import React from 'react';

export interface InspectorItem {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copy?: boolean;
  colSpan?: 1 | 2;
}

export interface InspectorPanelProps {
  title?: string;
  badge?: { text: string; color?: string };
  items: InspectorItem[];
  className?: string;
}

export function InspectorPanel({ items, title, badge, className }: InspectorPanelProps) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copy = (val: React.ReactNode) => {
    if (typeof val === 'string') {
      navigator.clipboard.writeText(val);
      setCopied(val);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-[#0a0a0f]", className)}>
      {/* Header */}
      {(title || badge) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white/[0.02]">
          {title && <span className="text-[11px] font-semibold text-foreground tracking-widest uppercase">{title}</span>}
          {badge && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-sm font-medium tracking-wide uppercase"
              style={{
                background: badge.color ? `${badge.color}20` : 'rgba(255,255,255,0.1)',
                color: badge.color || '#fff',
                border: `1px solid ${badge.color ? `${badge.color}40` : 'rgba(255,255,255,0.2)'}`
              }}
            >
              {badge.text}
            </span>
          )}
        </div>
      )}

      {/* Properties List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {items.map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-1.5",
                item.colSpan === 2 ? "col-span-2 border-t border-white/5 pt-3 mt-1" : "col-span-1"
              )}
            >
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</span>
              <div className="flex items-start justify-between gap-2 group">
                <span className={cn(
                  "text-xs text-foreground break-words leading-relaxed",
                  item.mono ? "font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/70" : ""
                )}>
                  {item.value}
                </span>
                {item.copy && typeof item.value === 'string' && (
                  <button
                    onClick={() => copy(item.value)}
                    className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
                    title="Copy to clipboard"
                  >
                    {copied === item.value ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
