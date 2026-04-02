'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Box, Building2, ChevronRight, FileText, Globe, Search, Shield, Sparkles, Terminal, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CommandParamsModal } from './CommandParamsModal';

// Maps backend entity types to UI groups
const TYPE_MAPPING: Record<string, { group: string, icon: any, color: string }> = {
  PUBLIC_PAGE: { group: 'Policy & Docs', icon: Globe, color: 'text-vt-neutral-200 bg-vt-neutral-800/30' },
  FAQ_DOC: { group: 'Policy & Docs', icon: FileText, color: 'text-vt-neutral-200 bg-vt-neutral-800/30' },
  EMPLOYER_PROFILE: { group: 'Employer', icon: Building2, color: 'text-vt-info bg-vt-info/10' },
  OPPORTUNITY: { group: 'Opportunity', icon: Sparkles, color: 'text-vt-success bg-vt-success/10' },
  ISSUER_PROFILE: { group: 'Issuer', icon: Shield, color: 'text-purple-400 bg-purple-400/10' },
  TRUST_STATE_SUMMARY: { group: 'Clinician', icon: User, color: 'text-blue-400 bg-blue-400/10' },
  CONNECTED_RECORD: { group: 'Artifact', icon: Box, color: 'text-orange-400 bg-orange-400/10' },
  DEFAULT: { group: 'Other', icon: FileText, color: 'text-vt-neutral-400 bg-vt-neutral-800/30' }
};

const QUICK_ACTIONS = [
  { id: 'AskVitalCV', label: 'Ask VitalCV AI', desc: 'Ask complex questions about compliance', icon: Sparkles, action: 'ask' },
  { id: 'VerifyNpiCommand', label: 'Verify a Clinician', desc: 'Lookup and verify NPI credentials', icon: Search, action: 'cmd' },
  { id: 'MissionOps', label: 'Mission Ops', desc: 'Control plane operations', icon: Terminal, action: 'nav', href: '/mission-ops/v2' },
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
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "relative flex flex-col w-full max-w-3xl overflow-hidden rounded-2xl bg-[#0a0a0f] border border-border shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-300",
                isResultsMode ? "h-[80vh] max-h-[800px]" : "h-auto"
              )}
            >
              {/* Sticky Search Header */}
              <div className="flex-none p-4 pb-2 border-b border-border shrink-0 bg-[#0a0a0f] z-10 sticky top-0">
                <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-vt-info/40 focus-within:border-vt-info transition-all">
                  <Search className="w-5 h-5 text-foreground/70 shrink-0" />
                  <input
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none outline-none text-lg text-foreground placeholder:text-muted-foreground/60"
                    placeholder="Search clinicians, employers, opportunities, or Ask AI..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={handleKeyDown}
                  />
                  {loading && <div className="w-4 h-4 rounded-full border-2 border-vt-info border-t-transparent animate-spin shrink-0" />}
                  <div className="flex gap-1 shrink-0 ml-2">
                    <kbd className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border">ESC</kbd>
                  </div>
                </div>

                {isResultsMode && Object.keys(groupedResults).length > 0 && (
                  <div className="flex gap-2 mt-4 px-1 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => { setActiveFilter(null); setSelectedIndex(0); }}
                      className={cn("px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors", activeFilter === null ? "bg-white text-black font-medium" : "bg-muted text-foreground hover:bg-muted hover:text-foreground")}
                    >
                      All Results
                    </button>
                    {Object.keys(groupedResults).map(g => (
                      <button
                        key={g}
                        onClick={() => { setActiveFilter(g); setSelectedIndex(0); }}
                        className={cn("px-3 py-1 text-xs rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors", activeFilter === g ? "bg-white text-black font-medium" : "bg-muted text-foreground hover:bg-muted hover:text-foreground")}
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
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested Actions</h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 bg-muted px-2 py-1 rounded-sm border border-white/5">
                        <Globe className="w-3 h-3" /> ACL-Safe Search Active
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
                              "flex flex-col items-start p-4 rounded-xl text-left transition-all border",
                              selected
                                ? "bg-muted border-border shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                                : "bg-transparent border-transparent hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-3 mb-2 w-full">
                              <div className={cn("p-2 rounded-lg", selected ? "bg-vt-info/20 text-vt-info" : "bg-muted text-foreground")}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="font-medium text-foreground flex-1">{action.label}</div>
                              {selected && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <div className="text-xs text-foreground/70 line-clamp-2">{action.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-8 px-2">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex gap-4 items-start">
                        <Sparkles className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium text-indigo-300 mb-1">Try Natural Language</h4>
                          <p className="text-xs text-foreground">
                            "What are the onboarding requirements for Kaiser ICU?" or "Show me all telemetry events from the last 24 hours."
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-2">
                    {groups.length === 0 && !loading && (
                      <div className="py-12 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Search className="w-5 h-5 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm text-foreground mb-4">No specific entities found.</p>
                        <button
                          onClick={() => { setOpen(false); router.push(`/ask?q=${encodeURIComponent(search)}`); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-foreground text-sm font-medium hover:bg-indigo-600 transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          Ask the swarm instead
                        </button>
                      </div>
                    )}

                    {groups.map(group => (
                      <div key={group} className="px-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2 flex justify-between items-center">
                          {group}
                          <span className="text-muted-foreground/40 text-[10px]">Source earmark active</span>
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
                                  "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all group",
                                  selected ? "bg-muted" : "hover:bg-muted"
                                )}
                              >
                                <div className={cn("p-1.5 rounded-md shrink-0 mt-0.5", item._meta.color)}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className={cn("font-medium truncate transition-colors", selected ? "text-white" : "text-foreground/80")}>
                                      {item.title}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground/70 line-clamp-1 group-hover:text-foreground/70 transition-colors">
                                    {item.snippet}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="shrink-0 flex items-center justify-center h-full text-muted-foreground mt-1">
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
              <div className="flex-none p-2 border-t border-border bg-black/40 text-[10px] text-muted-foreground/60 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded">↑↓</kbd> to navigate</span>
                  <span className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded">↵</kbd> to select</span>
                </div>
                <div>Global Control Plane Access</div>
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
