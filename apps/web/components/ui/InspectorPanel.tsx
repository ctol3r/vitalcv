'use client';
import React from 'react';

interface InspectorItem { label: string; value: React.ReactNode; mono?: boolean; copy?: boolean }
interface InspectorPanelProps { items: InspectorItem[]; title?: string; badge?: { text: string; color: string } }

export function InspectorPanel({ items, title, badge }: InspectorPanelProps) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = (val: React.ReactNode) => {
    if (typeof val === 'string') { navigator.clipboard.writeText(val); setCopied(val); setTimeout(() => setCopied(null), 1500); }
  };
  return (
    <div className="space-y-0">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{title}</span>
          {badge && <span className="text-xs px-2 py-0.5 rounded" style={{ background: badge.color, color: '#fff' }}>{badge.text}</span>}
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-start py-2 border-b border-white/5 last:border-0 gap-4">
          <span className="w-36 flex-shrink-0 text-xs text-white/40 pt-0.5">{item.label}</span>
          <span className={`flex-1 text-xs text-white break-all ${item.mono ? 'font-mono' : ''}`}>{item.value}</span>
          {item.copy && typeof item.value === 'string' && (
            <button onClick={() => copy(item.value)} className="text-[10px] text-white/30 hover:text-white/70 transition-colors flex-shrink-0">
              {copied === item.value ? '✓' : 'copy'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
