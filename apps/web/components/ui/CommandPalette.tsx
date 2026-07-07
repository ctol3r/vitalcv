'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Award, Box, Building2, ChevronRight, Compass, FileText, Fingerprint, Globe, Search, Shield, ShieldCheck, Sparkles, User, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CommandParamsModal } from './CommandParamsModal';

// Maps backend entity types to UI groups.
// Calm Wave dark instrument: one indigo accent, no jade/teal/coral. Icon chips are a
// faint charcoal fill (var(--vt-surface-subtle)) with muted ink; the selected row's
// icon is recolored to indigo in the row itself.
const ICON_CHIP = 'text-[var(--vt-text-secondary)] bg-[var(--vt-surface-subtle)]';
const TYPE_MAPPING: Record<string, { group: string, icon: any, color: string }> = {
  PUBLIC_PAGE: { group: 'Policy & Docs', icon: Globe, color: ICON_CHIP },
  FAQ_DOC: { group: 'Policy & Docs', icon: FileText, color: ICON_CHIP },
  EMPLOYER_PROFILE: { group: 'Employer', icon: Building2, color: ICON_CHIP },
  OPPORTUNITY: { group: 'Opportunity', icon: Sparkles, color: ICON_CHIP },
  ISSUER_PROFILE: { group: 'Issuer', icon: Shield, color: ICON_CHIP },
  TRUST_STATE_SUMMARY: { group: 'Clinician', icon: User, color: ICON_CHIP },
  CONNECTED_RECORD: { group: 'Artifact', icon: Box, color: ICON_CHIP },
  DEFAULT: { group: 'Other', icon: FileText, color: ICON_CHIP }
};

const QUICK_ACTIONS = [
  { id: 'GetReady', label: 'Confirm my NPI', desc: 'Start your source-backed wallet', icon: Fingerprint, action: 'nav', href: '/get-ready' },
  { id: 'Wallet', label: 'Open my wallet', desc: 'Your credentials, readiness, and proof', icon: Wallet, action: 'nav', href: '/holder' },
  { id: 'Readiness', label: 'Check my readiness', desc: 'Live source coverage and blockers', icon: ShieldCheck, action: 'nav', href: '/holder/readiness' },
  { id: 'Recognition', label: 'My Recognition', desc: 'Employer-accepted head starts', icon: Award, action: 'nav', href: '/holder/recognition' },
  { id: 'Opportunities', label: 'Find opportunities', desc: 'Roles matched to your evidence', icon: Compass, action: 'nav', href: '/holder/opportunities' },
  { id: 'VerifyNpiCommand', label: 'Look up a clinician', desc: 'See what is source-backed about an NPI', icon: Search, action: 'cmd' },
  { id: 'AskVitalCV', label: 'Ask VitalCV', desc: 'Ask about your readiness or the process', icon: Sparkles, action: 'ask' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Command modal fallback
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [commandSchema, setCommandSchema] = useState<Record<string, any> | null>(null);
  const [initialPayload, setInitialPayload] = useState<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    if (!open) return;
    if (!search.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchResults(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, open]);

  const fetchResults = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/search/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q.trim(), limit: 15 })
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setLoading(false);
      setSelectedIndex(0);
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((open) => !open);
      } else if (e.key === '/' && !open && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
      setResults([]);
      setActiveFilter(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Derived filtered results
  const groupedResults = results.reduce((acc, r) => {
    const meta = TYPE_MAPPING[r.type] || TYPE_MAPPING.DEFAULT;
    if (!acc[meta.group]) acc[meta.group] = [];
    acc[meta.group].push({ ...r, _meta: meta });
    return acc;
  }, {} as Record<string, any[]>);

  const groups = Object.keys(groupedResults).filter(g => !activeFilter || g === activeFilter);
  const flatVisibleItems = groups.flatMap(g => groupedResults[g]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatVisibleItems.length + (search ? 0 : QUICK_ACTIONS.length) - 1));
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      scrollSelectedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!search) {
        // Quick action
        const action = QUICK_ACTIONS[selectedIndex];
        if (action) handleQuickAction(action);
      } else {
        if (flatVisibleItems.length > 0) {
          const item = flatVisibleItems[selectedIndex];
          if (item) navigateToResult(item);
        } else {
          // Ask AI fallback
          router.push(`/ask?q=${encodeURIComponent(search)}`);
          setOpen(false);
        }
      }
    }
  };

  const scrollSelectedIntoView = () => {
    setTimeout(() => {
      if (!scrollRef.current) return;
      const selectedEl = scrollRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }, 0);
  };

  const handleQuickAction = async (action: typeof QUICK_ACTIONS[0]) => {
    if (action.action === 'nav') {
      setOpen(false);
      router.push(action.href!);
    } else if (action.action === 'ask') {
      setOpen(false);
      router.push('/ask');
    } else if (action.action === 'cmd') {
      setActiveCommand(action.id);
      try {
        const res = await fetch('/api/command/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: action.id })
        });
        const data = await res.json();
        setCommandSchema(data.schemaInfo);
        setInitialPayload({});
      } catch (e) {
        console.error(e);
      }
    }
  };

  const navigateToResult = (item: any) => {
    setOpen(false);
    if (item.sourceUrl) {
      if (item.sourceUrl.startsWith('/')) {
        router.push(item.sourceUrl);
      } else {
        window.open(item.sourceUrl, '_blank');
      }
    } else if (item.type === 'EMPLOYER_PROFILE') {
      router.push(`/employers/${item.id}`);
    } else if (item.type === 'TRUST_STATE_SUMMARY') {
      router.push(`/status/${item.id}`);
    }
  };

  const executeCommand = async (commandName: string, payload: any) => {
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandName, payload })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Success: ${data.message}\\nTxID: ${data.result.transactionId}`);
      } else {
        alert(`Error executing command: ${data.error}`);
      }
    } catch(e) {
      alert("Execution failed.");
    } finally {
      setOpen(false);
      setActiveCommand(null);
    }
  };

  // Determine modal size (centered vs full results mode)
  const isResultsMode = search.trim().length > 0;

  return (
    <>
      <AnimatePresence>
        {open && !activeCommand && (
          <div className="dark fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                "mz relative flex flex-col w-full max-w-2xl overflow-hidden rounded-[8px] border border-[var(--vt-border)] bg-[var(--card)] shadow-[0_32px_90px_-28px_rgba(0,0,0,0.85)]",
                isResultsMode ? "h-[80vh] max-h-[800px]" : "h-auto"
              )}
            >
              {/* Sticky Search Header */}
              <div className="flex-none p-4 pb-2 border-b border-[var(--vt-border)] shrink-0 bg-transparent z-10 sticky top-0">
                <div className="flex items-center gap-3 bg-[var(--vt-surface-subtle)] border border-[var(--vt-border)] rounded-[6px] px-4 py-3 focus-within:border-[var(--vt-accent)] transition-colors">
                  <Search className="w-5 h-5 text-[var(--vt-text-secondary)] shrink-0" />
                  <input
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none outline-none text-lg text-[var(--vt-text-primary)] placeholder:text-[var(--vt-text-muted)]"
                    placeholder="Jump to your wallet, readiness, or Recognition — or ask VitalCV"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={handleKeyDown}
                  />
                  {loading && <div className="w-4 h-4 rounded-full border-2 border-[var(--vt-accent)] border-t-transparent animate-spin shrink-0" />}
                  <div className="flex gap-1 shrink-0 ml-2">
                    <kbd className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[10px] uppercase font-[family-name:var(--font-geist-mono)] text-[var(--vt-text-muted)] bg-[var(--vt-surface-subtle)] rounded-[4px] border border-[var(--vt-border)]">ESC</kbd>
                  </div>
                </div>

                {isResultsMode && Object.keys(groupedResults).length > 0 && (
                  <div className="flex gap-2 mt-4 px-1 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => { setActiveFilter(null); setSelectedIndex(0); }}
                      className={cn(
                        "px-3 py-1 text-[11px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] rounded-[4px] whitespace-nowrap border transition-colors",
                        activeFilter === null
                          ? "bg-[color-mix(in_oklab,var(--vt-accent)_16%,transparent)] border-[var(--vt-accent)] text-[var(--vt-text-primary)]"
                          : "bg-transparent border-[var(--vt-border)] text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:border-[var(--vt-text-muted)]"
                      )}
                    >
                      All Results
                    </button>
                    {Object.keys(groupedResults).map(g => (
                      <button
                        key={g}
                        onClick={() => { setActiveFilter(g); setSelectedIndex(0); }}
                        className={cn(
                          "px-3 py-1 text-[11px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] rounded-[4px] whitespace-nowrap flex items-center gap-1.5 border transition-colors",
                          activeFilter === g
                            ? "bg-[color-mix(in_oklab,var(--vt-accent)_16%,transparent)] border-[var(--vt-accent)] text-[var(--vt-text-primary)]"
                            : "bg-transparent border-[var(--vt-border)] text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:border-[var(--vt-text-muted)]"
                        )}
                      >
                        {g} <span className="text-[10px] opacity-60">({groupedResults[g].length})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Scrollable Content */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 pb-4 overscroll-contain">
                {!isResultsMode ? (
                  <div className="px-2 py-4">
                    <div className="flex items-center justify-between px-2 mb-3">
                      <h3 className="text-[11px] font-[family-name:var(--font-geist-mono)] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Quick actions</h3>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] text-[var(--vt-text-muted)] bg-[var(--vt-surface-subtle)] px-2.5 py-1 rounded-[4px] border border-[var(--vt-border)]">
                        ↑↓ move · ↵ open · esc close
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {QUICK_ACTIONS.map((action, i) => {
                        const Icon = action.icon;
                        const selected = selectedIndex === i;
                        return (
                          <button
                            key={action.id}
                            data-selected={selected}
                            onClick={() => handleQuickAction(action)}
                            onMouseEnter={() => setSelectedIndex(i)}
                            className={cn(
                              "relative flex flex-col items-start p-4 pl-5 rounded-[6px] text-left border transition-colors",
                              // left indigo accent bar on the selected row
                              "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:transition-colors",
                              selected
                                ? "bg-[color-mix(in_oklab,var(--vt-accent)_14%,transparent)] border-[var(--vt-accent)] before:bg-[var(--vt-accent)]"
                                : "bg-transparent border-[var(--vt-border)] hover:bg-[var(--vt-surface-subtle)] before:bg-transparent"
                            )}
                          >
                            <div className="flex items-center gap-3 mb-2 w-full">
                              <div className={cn("p-2 rounded-[4px] transition-colors", selected ? "bg-[color-mix(in_oklab,var(--vt-accent)_18%,transparent)] text-[var(--vt-accent)]" : "bg-[var(--vt-surface-subtle)] text-[var(--vt-text-secondary)]")}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="font-medium text-[var(--vt-text-primary)] flex-1">{action.label}</div>
                              {selected && <ArrowRight className="w-4 h-4 text-[var(--vt-accent)]" />}
                            </div>
                            <div className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--vt-text-muted)] line-clamp-2">{action.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-8 px-2">
                      <div className="p-4 rounded-[6px] bg-[var(--vt-surface-subtle)] border border-[var(--vt-border)] flex gap-4 items-start">
                        <Sparkles className="w-6 h-6 text-[var(--vt-accent)] shrink-0 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium text-[var(--vt-text-primary)] mb-1">Ask in plain language</h4>
                          <p className="text-xs text-[var(--vt-text-secondary)]">
                            &ldquo;What&rsquo;s blocking my readiness?&rdquo; or &ldquo;Which sources are still gated for my NPI?&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-2">
                    {groups.length === 0 && !loading && (
                      <div className="py-12 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-[var(--vt-surface-subtle)] border border-[var(--vt-border)] flex items-center justify-center mb-4">
                          <Search className="w-5 h-5 text-[var(--vt-text-muted)]" />
                        </div>
                        <p className="text-sm text-[var(--vt-text-primary)] mb-4">No specific entities found.</p>
                        <button
                          onClick={() => { setOpen(false); router.push(`/ask?q=${encodeURIComponent(search)}`); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[var(--vt-accent)] text-[var(--card)] text-sm font-medium hover:bg-[color-mix(in_oklab,var(--vt-accent)_85%,#000)] transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          Ask VitalCV instead
                        </button>
                      </div>
                    )}

                    {groups.map(group => (
                      <div key={group} className="px-2">
                        <h3 className="text-[11px] font-[family-name:var(--font-geist-mono)] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)] mb-2 px-2 flex justify-between items-center">
                          {group}
                          <span className="text-[var(--vt-text-muted)] opacity-70 text-[10px]">Source earmark active</span>
                        </h3>
                        <div className="space-y-1">
                          {groupedResults[group].map((item: any) => {
                            const globalIndex = flatVisibleItems.indexOf(item);
                            const selected = selectedIndex === globalIndex;
                            const Icon = item._meta.icon;
                            return (
                              <button
                                key={item.id}
                                data-selected={selected}
                                onClick={() => navigateToResult(item)}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                className={cn(
                                  "relative w-full flex items-start gap-3 p-3 pl-4 rounded-[6px] text-left border transition-colors group",
                                  "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:transition-colors",
                                  selected
                                    ? "bg-[color-mix(in_oklab,var(--vt-accent)_14%,transparent)] border-[var(--vt-accent)] before:bg-[var(--vt-accent)]"
                                    : "bg-transparent border-transparent hover:bg-[var(--vt-surface-subtle)] before:bg-transparent"
                                )}
                              >
                                <div className={cn("p-1.5 rounded-[4px] shrink-0 mt-0.5 transition-colors", selected ? "bg-[color-mix(in_oklab,var(--vt-accent)_18%,transparent)] text-[var(--vt-accent)]" : item._meta.color)}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className={cn("font-medium truncate transition-colors", selected ? "text-[var(--vt-text-primary)]" : "text-[var(--vt-text-secondary)]")}>
                                      {item.title}
                                    </span>
                                  </div>
                                  <p className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--vt-text-muted)] line-clamp-1 transition-colors">
                                    {item.snippet}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="shrink-0 flex items-center justify-center h-full text-[var(--vt-accent)] mt-1">
                                    <ChevronRight className="w-4 h-4" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex-none p-2 border-t border-[var(--vt-border)] bg-transparent text-[10px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] text-[var(--vt-text-muted)] flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><kbd className="bg-[var(--vt-surface-subtle)] border border-[var(--vt-border)] px-1 rounded-[3px]">↑↓</kbd> to navigate</span>
                  <span className="flex items-center gap-1"><kbd className="bg-[var(--vt-surface-subtle)] border border-[var(--vt-border)] px-1 rounded-[3px]">↵</kbd> to select</span>
                </div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--vt-accent)]" /> VitalCV · your career wallet</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Zod-to-Form Generator Modal */}
      <AnimatePresence>
        {activeCommand && commandSchema && (
          <CommandParamsModal
            commandName={activeCommand}
            schemaInfo={commandSchema}
            initialData={initialPayload}
            onClose={() => { setActiveCommand(null); setCommandSchema(null); setInitialPayload(null); }}
            onSubmit={(payload) => executeCommand(activeCommand, payload)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
