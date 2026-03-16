'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, FileText, BookOpen, Terminal, ArrowRight } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommandResult {
  id: string;
  type: 'provider' | 'finding' | 'storyline' | 'command' | 'copilot';
  icon: typeof Search;
  title: string;
  subtitle: string;
  href?: string;
  action?: () => void;
}

// ── Built-in commands ──────────────────────────────────────────────────────────

function getBuiltinCommands(router: ReturnType<typeof useRouter>): CommandResult[] {
  return [
    { id: 'cmd-graph', type: 'command', icon: Terminal, title: 'Open Graph', subtitle: '/graph', href: '/graph' },
    { id: 'cmd-findings', type: 'command', icon: Terminal, title: 'All Findings', subtitle: '/findings', href: '/findings' },
    { id: 'cmd-storylines', type: 'command', icon: Terminal, title: 'All Storylines', subtitle: '/storylines', href: '/storylines' },
    { id: 'cmd-calibration', type: 'command', icon: Terminal, title: 'Calibration Dashboard', subtitle: '/calibration', href: '/calibration' },
    { id: 'cmd-health', type: 'command', icon: Terminal, title: 'System Health', subtitle: '/system-health', href: '/system-health' },
    { id: 'cmd-intelligence', type: 'command', icon: Terminal, title: 'Intelligence Console', subtitle: '/intelligence', href: '/intelligence' },
    { id: 'cmd-providers', type: 'command', icon: Terminal, title: 'Providers', subtitle: '/providers', href: '/providers' },
    { id: 'cmd-investigations', type: 'command', icon: Terminal, title: 'Investigation Workbench', subtitle: '/investigations', href: '/investigations' },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const builtins = useMemo(() => getBuiltinCommands(router), [router]);

  // ── ⌘K listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setPreview(null);
    }
  }, [open]);

  // ── Search logic ─────────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(builtins.slice(0, 6));
      return;
    }

    const lower = trimmed.toLowerCase();
    const matched: CommandResult[] = [];

    // Direct NPI
    if (/^\d{10}$/.test(trimmed)) {
      matched.push({
        id: `npi-${trimmed}`,
        type: 'provider',
        icon: User,
        title: `Provider NPI ${trimmed}`,
        subtitle: 'Open investigation',
        href: `/investigations?npi=${trimmed}`,
      });
    }

    // Command mode (starts with >)
    if (lower.startsWith('>')) {
      const cmd = lower.slice(1).trim();
      const cmdResults = builtins.filter(b =>
        b.title.toLowerCase().includes(cmd) || b.subtitle.toLowerCase().includes(cmd)
      );
      matched.push(...cmdResults);
      setResults(matched);
      return;
    }

    // Builtin command matches
    const cmdMatches = builtins.filter(b =>
      b.title.toLowerCase().includes(lower)
    ).slice(0, 3);
    matched.push(...cmdMatches);

    // Search API for providers/findings/storylines
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`);
      if (res.ok) {
        const data = await res.json() as {
          results?: Array<{
            id: string;
            type: string;
            title: string;
            subtitle?: string;
            href?: string;
          }>;
        };
        for (const r of (data.results ?? [])) {
          const icon = r.type === 'provider' ? User : r.type === 'finding' ? FileText : BookOpen;
          matched.push({
            id: r.id,
            type: r.type as CommandResult['type'],
            icon,
            title: r.title,
            subtitle: r.subtitle ?? r.type,
            href: r.href ?? `/${r.type}s/${r.id}`,
          });
        }
      }
    } catch { /* silent */ }

    // If query looks like a copilot question, add copilot option
    if (trimmed.length > 10 && !trimmed.startsWith('>')) {
      matched.push({
        id: 'copilot-query',
        type: 'copilot',
        icon: Search,
        title: `Ask Copilot: "${trimmed.slice(0, 50)}"`,
        subtitle: 'Intelligence query',
        href: `/intelligence?q=${encodeURIComponent(trimmed)}`,
      });
    }

    setLoading(false);
    setResults(matched);
    setSelectedIdx(0);
  }, [builtins]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void search(query), 150);
    return () => clearTimeout(timer);
  }, [query, open, search]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      const r = results[selectedIdx]!;
      if (r.action) r.action();
      else if (r.href) router.push(r.href);
      setOpen(false);
    } else if (e.key === 'Tab' && results[selectedIdx]) {
      e.preventDefault();
      setQuery(results[selectedIdx]!.title);
    }
  }, [results, selectedIdx, router]);

  // Update preview on selection change
  useEffect(() => {
    setPreview(results[selectedIdx] ?? null);
  }, [selectedIdx, results]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative flex w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] shadow-2xl"
        style={{ maxHeight: '480px' }}>
        <div className="flex flex-1 flex-col" style={{ minWidth: 0 }}>
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-[var(--vt-border)] px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--vt-text-3)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search providers, findings, storylines… or type > for commands"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)] focus:outline-none"
            />
            {loading ? (
              <span className="text-xs text-[var(--vt-text-3)]">…</span>
            ) : (
              <kbd className="rounded border border-[var(--vt-border)] px-1.5 py-0.5 text-[10px] text-[var(--vt-text-3)]">esc</kbd>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {results.length === 0 && query ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--vt-text-3)]">
                No results for &quot;{query}&quot;
              </p>
            ) : null}
            {results.map((r, i) => {
              const Icon = r.icon;
              const selected = i === selectedIdx;
              return (
                <button
                  key={r.id}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selected ? 'bg-cyan-400/8 text-[var(--vt-text-1)]' : 'text-[var(--vt-text-2)] hover:bg-[var(--vt-surface-2)]'
                  }`}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => {
                    if (r.action) r.action();
                    else if (r.href) router.push(r.href);
                    setOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--vt-text-3)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="truncate text-xs text-[var(--vt-text-3)]">{r.subtitle}</p>
                  </div>
                  {selected ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-cyan-400" /> : null}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center gap-4 border-t border-[var(--vt-border)] px-4 py-2 text-[10px] text-[var(--vt-text-3)]">
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">↑↓</kbd> Navigate</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">↵</kbd> Open</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">Tab</kbd> Autocomplete</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">&gt;</kbd> Commands</span>
          </div>
        </div>

        {/* Preview pane */}
        {preview && query ? (
          <div className="hidden w-56 shrink-0 border-l border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4 lg:block">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--vt-text-3)]">{preview.type}</p>
            <p className="mt-2 text-sm font-medium text-[var(--vt-text-1)]">{preview.title}</p>
            <p className="mt-1 text-xs text-[var(--vt-text-3)]">{preview.subtitle}</p>
            {preview.href ? (
              <p className="mt-3 truncate text-xs text-cyan-400">{preview.href}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
