'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, Send, Sparkles, X } from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CopilotAnswer {
  answer: string;
  intent: string;
  confidence: number;
  suggestions: string[];
  sources: string[];
  timing: number;
  data: unknown;
}

interface CopilotSearchBarProps {
  /** Compact mode for TopNav embedding */
  compact?: boolean;
  /** Session id for conversation continuity */
  sessionId?: string;
  /** Callback when a result contains an NPI to navigate to */
  onNavigateToNpi?: (npi: string) => void;
  /** Callback when a graph node should be focused */
  onFocusGraphNode?: (nodeId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

const SUGGESTIONS = [
  'Show declining trust scores',
  'Find cardiologists in California',
  'What is L3 verification?',
  'Any alerts?',
];

// ── Component ──────────────────────────────────────────────────────────────────

export function CopilotSearchBar({
  compact = false,
  sessionId = 'copilot-ui',
  onNavigateToNpi,
  onFocusGraphNode,
  placeholder = 'Ask about providers, trust scores, or network insights…',
  autoFocus = false,
}: CopilotSearchBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Keyboard shortcut: Cmd+K / Ctrl+K ────────────────────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setExpanded(true);
      }
      if (e.key === 'Escape') {
        setExpanded(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Click outside to collapse ────────────────────────────────────────────
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    setAnswer(null);
    setExpanded(true);

    try {
      const res = await fetch('/api/copilot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CopilotAnswer = await res.json();
      setAnswer(data);

      // If the answer contains NPI data, allow navigation
      const npiMatch = data.answer.match(/NPI (\d{10})/);
      if (npiMatch && onNavigateToNpi) {
        // Don't auto-navigate — let user click
      }
    } catch {
      setError('Copilot unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, sessionId, onNavigateToNpi]);

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSubmit(query);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(query);
    }
  };

  // ── Extract NPIs from answer for clickable links ─────────────────────────
  const renderAnswer = (text: string) => {
    // Convert **bold** to <strong>
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        // Check if it contains an NPI
        const npiInner = inner.match(/NPI (\d{10})/);
        if (npiInner && onNavigateToNpi) {
          return (
            <strong
              key={i}
              className="cursor-pointer text-blue-400 hover:text-blue-300 transition-colors"
              onClick={() => onNavigateToNpi(npiInner[1]!)}
              role="button"
              tabIndex={0}
            >
              {inner}
            </strong>
          );
        }
        return <strong key={i} className="text-white/95">{inner}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={panelRef} className={`relative ${compact ? 'w-full' : 'w-full max-w-3xl mx-auto'}`}>
      {/* Search input */}
      <form onSubmit={onFormSubmit} className="relative">
        <div className={`
          flex items-center gap-2 rounded-2xl border transition-all duration-200
          ${expanded
            ? 'border-blue-500/30 bg-[#0a1020] shadow-[0_0_30px_rgba(59,130,246,0.08)]'
            : 'border-white/10 bg-[#0c1218] hover:border-white/15'
          }
          ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}
        `}>
          {loading
            ? <Loader2 className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-blue-400 animate-spin shrink-0`} />
            : <Search className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-white/30 shrink-0`} />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setExpanded(true)}
            onKeyDown={onKeyDown}
            placeholder={compact ? 'Ask Copilot… ⌘K' : placeholder}
            autoFocus={autoFocus}
            className={`
              flex-1 bg-transparent text-white/90 placeholder:text-white/25
              focus:outline-none
              ${compact ? 'text-sm py-1' : 'text-base py-2'}
            `}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setAnswer(null); setError(''); }}
              className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className={`
              rounded-xl transition-all duration-200 shrink-0
              ${query.trim()
                ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500 hover:text-white'
                : 'bg-white/5 text-white/15'
              }
              ${compact ? 'p-1.5' : 'p-2'}
            `}
          >
            <Send className={`${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
          </button>
        </div>

        {/* Keyboard hint */}
        {!compact && !expanded && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2 pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/25 font-mono">
              ⌘K
            </kbd>
          </div>
        )}
      </form>

      {/* Expanded results panel */}
      <AnimatePresence>
        {expanded && (answer || error || (!answer && !loading && !query)) && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute left-0 right-0 z-50 mt-2 rounded-2xl border border-white/10
              bg-[#0a1020]/95 backdrop-blur-xl shadow-2xl overflow-hidden
              ${compact ? 'max-h-[60vh]' : 'max-h-[70vh]'}
            `}
          >
            <div className="overflow-y-auto max-h-[inherit] p-4">
              {/* Error */}
              {error && (
                <p className="text-sm text-red-400/80 py-2">{error}</p>
              )}

              {/* Answer */}
              {answer && (
                <div className="space-y-3">
                  {/* Intent badge + timing */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20">
                      <Sparkles className="h-2.5 w-2.5" />
                      {answer.intent}
                    </span>
                    <span className="text-[11px] text-white/20">
                      {answer.timing}ms · {Math.round(answer.confidence * 100)}% confidence
                    </span>
                  </div>

                  {/* Answer text */}
                  <div className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                    {renderAnswer(answer.answer)}
                  </div>

                  {/* Sources */}
                  {answer.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-white/20 uppercase tracking-wider">Sources:</span>
                      {answer.sources.map((s, i) => (
                        <span key={i} className="text-[10px] text-white/30 bg-white/5 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {answer.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                      {answer.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setQuery(s); handleSubmit(s); }}
                          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                        >
                          <Search className="h-2.5 w-2.5" />
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state: show suggestions */}
              {!answer && !loading && !query && (
                <div className="space-y-2 py-1">
                  <p className="text-[11px] text-white/20 uppercase tracking-wider mb-2">Suggested</p>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(s); handleSubmit(s); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <Search className="h-3 w-3 shrink-0 text-white/20" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
