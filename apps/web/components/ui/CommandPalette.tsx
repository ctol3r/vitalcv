'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Award, Box, Building2, ChevronRight, Compass, FileText, Fingerprint, Globe, Search, Shield, ShieldCheck, Sparkles, User, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CommandParamsModal } from './CommandParamsModal';

// Maps backend entity types to UI groups.
// Calm Wave D56 light: paper + ink + one ink-indigo accent, no jade/teal/coral. Icon chips
// are a light paper fill (var(--paper-2)) with muted ink; the selected row's icon is
// recolored to ink-indigo (var(--accent)) in the row itself.
const ICON_CHIP = 'text-[var(--ink-600)] bg-[var(--paper-2)]';
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
  { id: 'GetReady', label: 'Confirm my NPI', desc: 'Start your source-backed profile', icon: Fingerprint, action: 'nav', href: '/onboarding' },
  { id: 'Wallet', label: 'Open my profile', desc: 'Your credentials, readiness, and proof', icon: Wallet, action: 'nav', href: '/holder' },
  { id: 'Readiness', label: 'Check my readiness', desc: 'Live source coverage and blockers', icon: ShieldCheck, action: 'nav', href: '/holder/readiness' },
  { id: 'Recognition', label: 'My Recognition', desc: 'Employer-accepted head starts', icon: Award, action: 'nav', href: '/holder/recognition' },
  { id: 'Opportunities', label: 'Find opportunities', desc: 'Roles matched to your evidence', icon: Compass, action: 'nav', href: '/holder/opportunities' },
  { id: 'VerifyNpiCommand', label: 'Look up a clinician', desc: 'See what is source-backed about an NPI', icon: Search, action: 'cmd' },
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
        }
        // No match: hold the palette open so the query can be refined. This
        // used to push `/ask?q=`, which 404s — /ask was retired to _archive
        // (wave119) and its archived page redirects to `/`, so there is no
        // natural-language surface to fall back to.
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
          <div className="mz fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 bg-[color-mix(in_oklch,var(--ink-900)_28%,transparent)] backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--rule)',
                boxShadow: '0 24px 60px -30px oklch(20% 0.02 265 / 0.28)',
              }}
              className={cn(
                "mz relative flex flex-col w-full max-w-2xl overflow-hidden rounded-[8px]",
                isResultsMode ? "h-[80vh] max-h-[800px]" : "h-auto"
              )}
            >
              {/* Sticky Search Header */}
              <div className="flex-none p-4 pb-2 border-b border-[var(--rule)] shrink-0 bg-transparent z-10 sticky top-0">
                <div className="flex items-center gap-3 bg-[var(--ink-50)] border border-[var(--rule)] rounded-[6px] px-4 py-3 focus-within:border-[var(--accent)] transition-colors">
                  <Search className="w-5 h-5 text-[var(--ink-500)] shrink-0" />
                  <input
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none outline-none text-lg text-[var(--ink-900)] placeholder:text-[var(--ink-400)] placeholder:font-[family-name:var(--font-geist-mono)]"
                    placeholder="Jump to your profile, readiness, or Recognition — or search clinicians and employers"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={handleKeyDown}
                  />
                  {loading && <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin shrink-0" />}
                  <div className="flex gap-1 shrink-0 ml-2">
                    <kbd className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[10px] uppercase font-[family-name:var(--font-geist-mono)] text-[var(--ink-500)] bg-[var(--card)] rounded-[4px] border border-[var(--rule)]">ESC</kbd>
                  </div>
                </div>

                {isResultsMode && Object.keys(groupedResults).length > 0 && (
                  <div className="flex gap-2 mt-4 px-1 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => { setActiveFilter(null); setSelectedIndex(0); }}
                      className={cn(
                        "px-3 py-1 text-[11px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] rounded-[4px] whitespace-nowrap border transition-colors",
                        activeFilter === null
                          ? "bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] border-[var(--accent)] text-[var(--accent)]"
                          : "bg-transparent border-[var(--rule)] text-[var(--ink-500)] hover:text-[var(--ink-900)] hover:border-[var(--ink-400)]"
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
                            ? "bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] border-[var(--accent)] text-[var(--accent)]"
                            : "bg-transparent border-[var(--rule)] text-[var(--ink-500)] hover:text-[var(--ink-900)] hover:border-[var(--ink-400)]"
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
                      <h3 className="text-[11px] font-[family-name:var(--font-geist-mono)] font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">Quick actions</h3>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] text-[var(--ink-500)] bg-[var(--paper-2)] px-2.5 py-1 rounded-[4px] border border-[var(--rule)]">
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
                                ? "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] border-[var(--accent)] before:bg-[var(--accent)]"
                                : "bg-transparent border-[var(--rule)] hover:bg-[var(--ink-50)] before:bg-transparent"
                            )}
                          >
                            <div className="flex items-center gap-3 mb-2 w-full">
                              <div className={cn("p-2 rounded-[4px] transition-colors", selected ? "bg-[color-mix(in_oklch,var(--accent)_15%,transparent)] text-[var(--accent)]" : "bg-[var(--paper-2)] text-[var(--ink-600)]")}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="font-medium text-[var(--ink-900)] flex-1">{action.label}</div>
                              {selected && <ArrowRight className="w-4 h-4 text-[var(--accent)]" />}
                            </div>
                            <div className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--ink-500)] line-clamp-2">{action.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-8 px-2">
                      <div className="p-4 rounded-[6px] bg-[var(--paper-2)] border border-[var(--rule)] flex gap-4 items-start">
                        <Search className="w-6 h-6 text-[var(--accent)] shrink-0 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium text-[var(--ink-900)] mb-1">What you can search</h4>
                          <p className="text-xs text-[var(--ink-600)]">
                            Clinicians by NPI or name, employers, and open roles. Search matches records, not questions.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-2">
                    {groups.length === 0 && !loading && (
                      <div className="py-12 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-[var(--paper-2)] border border-[var(--rule)] flex items-center justify-center mb-4">
                          <Search className="w-5 h-5 text-[var(--ink-400)]" />
                        </div>
                        <p className="text-sm text-[var(--ink-900)] mb-1">No specific entities found.</p>
                        <p className="text-xs text-[var(--ink-600)]">
                          Try a 10-digit NPI, a clinician name, or an employer.
                        </p>
                      </div>
                    )}

                    {groups.map(group => (
                      <div key={group} className="px-2">
                        <h3 className="text-[11px] font-[family-name:var(--font-geist-mono)] font-medium uppercase tracking-[0.14em] text-[var(--ink-500)] mb-2 px-2 flex justify-between items-center">
                          {group}
                          <span className="text-[var(--ink-400)] opacity-70 text-[10px]">Source earmark active</span>
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
                                    ? "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] border-[var(--accent)] before:bg-[var(--accent)]"
                                    : "bg-transparent border-transparent hover:bg-[var(--ink-50)] before:bg-transparent"
                                )}
                              >
                                <div className={cn("p-1.5 rounded-[4px] shrink-0 mt-0.5 transition-colors", selected ? "bg-[color-mix(in_oklch,var(--accent)_15%,transparent)] text-[var(--accent)]" : item._meta.color)}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className={cn("font-medium truncate transition-colors", selected ? "text-[var(--ink-900)]" : "text-[var(--ink-700)]")}>
                                      {item.title}
                                    </span>
                                  </div>
                                  <p className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--ink-500)] line-clamp-1 transition-colors">
                                    {item.snippet}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="shrink-0 flex items-center justify-center h-full text-[var(--accent)] mt-1">
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
              <div className="flex-none p-2 border-t border-[var(--rule)] bg-transparent text-[10px] uppercase tracking-wide font-[family-name:var(--font-geist-mono)] text-[var(--ink-500)] flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><kbd className="bg-[var(--paper-2)] border border-[var(--rule)] px-1 rounded-[3px]">↑↓</kbd> to navigate</span>
                  <span className="flex items-center gap-1"><kbd className="bg-[var(--paper-2)] border border-[var(--rule)] px-1 rounded-[3px]">↵</kbd> to select</span>
                </div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> VitalCV · your career profile</div>
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
