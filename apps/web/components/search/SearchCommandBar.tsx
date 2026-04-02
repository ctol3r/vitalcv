'use client';
import React, { useEffect, useRef } from 'react';

const SCOPES = ['All', 'Clinicians', 'Employers', 'Issuers', 'Artifacts', 'Policies'];
interface Props { query: string; onQueryChange: (q: string) => void; scope: string; onScopeChange: (s: string) => void; operatorMode?: boolean; onOperatorToggle?: () => void }

export function SearchCommandBar({ query, onQueryChange, scope, onScopeChange, operatorMode, onOperatorToggle }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <div className="sticky top-0 z-40 bg-[var(--color-surface-elevated,#0f0f1a)] border-b border-border px-4 py-3">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm">⌘K</span>
          <input ref={inputRef} value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search everything connected to VitalCV…"
            className="w-full h-10 pl-12 pr-4 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-border font-mono" />
          {query && <button onClick={() => onQueryChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">✕</button>}
        </div>
        <div className="flex gap-1">
          {SCOPES.map((s) => (
            <button key={s} onClick={() => onScopeChange(s)}
              className={`px-3 py-1 rounded text-xs transition-colors ${scope === s ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground/70'}`}>
              {s}
            </button>
          ))}
        </div>
        {onOperatorToggle && (
          <button onClick={onOperatorToggle} className={`px-3 py-1 rounded text-xs border transition-colors ${operatorMode ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-border text-muted-foreground/60 hover:text-foreground'}`}>
            Operator
          </button>
        )}
      </div>
    </div>
  );
}
