'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  ChevronRight,
  Command,
  FileCheck2,
  Globe2,
  Search,
  Shield,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface OmniCommand {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
  group: string;
  keywords: string[];
  action: () => void;
}

function buildGraphHref(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim().length > 0) {
      search.set(key, value);
    }
  }

  const serialized = search.toString();
  return serialized.length > 0 ? `/graph?${serialized}` : '/graph';
}

export default function Omnibar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const navigate = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
    router.push(path);
  }, [router]);

  const baseCommands: OmniCommand[] = useMemo(() => [
    {
      id: 'navigate-graph',
      label: 'Open intelligence shell',
      description: 'Three-panel provider intelligence workspace',
      icon: Workflow,
      group: 'Navigation',
      keywords: ['graph', 'workspace', 'intelligence', 'shell'],
      action: () => navigate('/graph'),
    },
    {
      id: 'navigate-command-center',
      label: 'Open command center',
      description: 'Operational monitoring and incident flow',
      icon: Shield,
      group: 'Navigation',
      keywords: ['command', 'center', 'alerts', 'operations'],
      action: () => navigate('/command-center'),
    },
    {
      id: 'navigate-network',
      label: 'Open network view',
      description: 'Network-wide trust topology',
      icon: Globe2,
      group: 'Navigation',
      keywords: ['network', 'topology', 'map'],
      action: () => navigate('/network'),
    },
    {
      id: 'navigate-developers',
      label: 'Open developer docs',
      description: 'SDK and API documentation',
      icon: Command,
      group: 'Navigation',
      keywords: ['developers', 'docs', 'sdk', 'api'],
      action: () => navigate('/developers'),
    },
    {
      id: 'provider-search',
      label: 'Search providers',
      description: 'Jump into the graph workspace and filter provider profiles',
      icon: Search,
      group: 'Workspace',
      keywords: ['providers', 'search', 'profiles'],
      action: () => navigate(buildGraphHref({
        command: 'provider-search',
        q: query || 'cardiology',
        rid: String(Date.now()),
      })),
    },
    {
      id: 'ask-copilot',
      label: 'Ask Copilot',
      description: 'Open the intelligence shell and run a Copilot query',
      icon: Bot,
      group: 'Workspace',
      keywords: ['copilot', 'ask', 'research', 'trust'],
      action: () => navigate(buildGraphHref({
        command: 'copilot',
        prompt: query || 'Which providers are ready for verification?',
        rid: String(Date.now()),
      })),
    },
    {
      id: 'run-verification',
      label: 'Run verification',
      description: 'Open the intelligence shell and generate a verification brief',
      icon: FileCheck2,
      group: 'Workspace',
      keywords: ['verify', 'verification', 'trust'],
      action: () => navigate(buildGraphHref({
        command: 'verify',
        q: query || 'Mayo Clinic',
        rid: String(Date.now()),
      })),
    },
  ], [navigate, query]);

  const dynamicCommands = useMemo<OmniCommand[]>(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 3) {
      return [];
    }

    return [
      {
        id: `search:${normalizedQuery}`,
        label: `Search providers for "${normalizedQuery}"`,
        description: 'Apply the query to provider profiles and search results in the intelligence shell',
        icon: Search,
        group: 'Search',
        keywords: ['search', 'providers', normalizedQuery.toLowerCase()],
        action: () => navigate(buildGraphHref({
          command: 'provider-search',
          q: normalizedQuery,
          rid: String(Date.now()),
        })),
      },
      {
        id: `copilot:${normalizedQuery}`,
        label: `Ask Copilot: "${normalizedQuery}"`,
        description: 'Run the query through the Copilot panel inside the intelligence shell',
        icon: Bot,
        group: 'Copilot',
        keywords: ['copilot', 'ask', normalizedQuery.toLowerCase()],
        action: () => navigate(buildGraphHref({
          command: 'copilot',
          prompt: normalizedQuery,
          rid: String(Date.now()),
        })),
      },
      {
        id: `verify:${normalizedQuery}`,
        label: `Run verification for "${normalizedQuery}"`,
        description: 'Generate a verification brief against the current graph slice',
        icon: FileCheck2,
        group: 'Verification',
        keywords: ['verification', 'verify', normalizedQuery.toLowerCase()],
        action: () => navigate(buildGraphHref({
          command: 'verify',
          q: normalizedQuery,
          rid: String(Date.now()),
        })),
      },
    ];
  }, [navigate, query]);

  const commands = useMemo(() => [...dynamicCommands, ...baseCommands], [baseCommands, dynamicCommands]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const normalizedQuery = query.toLowerCase();
    return commands.filter((command) => (
      command.label.toLowerCase().includes(normalizedQuery) ||
      command.description.toLowerCase().includes(normalizedQuery) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))
    ));
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, OmniCommand[]>();

    for (const command of filtered) {
      const existing = groups.get(command.group) ?? [];
      existing.push(command);
      groups.set(command.group, existing);
    }

    return groups;
  }, [filtered]);

  const openPalette = useCallback(() => {
    setOpen(true);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((previous) => !previous);
        setSelectedIndex(0);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    function handleProgrammaticOpen() {
      openPalette();
    }

    window.addEventListener('vital:open-command-palette', handleProgrammaticOpen);
    return () => window.removeEventListener('vital:open-command-palette', handleProgrammaticOpen);
  }, [openPalette]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleListNavigation(event: KeyboardEvent) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        filtered[selectedIndex]?.action();
      }
    }

    window.addEventListener('keydown', handleListNavigation);
    return () => window.removeEventListener('keydown', handleListNavigation);
  }, [filtered, open, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="omnibar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <motion.div
            key="omnibar-palette"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed left-1/2 top-[18%] z-[9999] w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-infra-border bg-infra-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-infra-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-infra-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search providers, ask Copilot, run verification, navigate..."
                className="flex-1 bg-transparent text-sm text-infra-text outline-none placeholder:text-infra-muted/50"
                spellCheck={false}
                autoComplete="off"
              />
              <div className="flex items-center gap-1">
                <kbd className="rounded border border-infra-border bg-infra-bg px-1.5 py-0.5 font-mono text-[10px] text-infra-muted">
                  esc
                </kbd>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-0.5 transition-colors hover:bg-infra-bg"
                >
                  <X className="h-3.5 w-3.5 text-infra-muted" />
                </button>
              </div>
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-infra-muted">
                  No matching commands
                </div>
              ) : null}

              {[...grouped.entries()].map(([group, items]) => (
                <div key={group}>
                  <div className="bg-infra-bg/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-infra-muted">
                    {group}
                  </div>
                  {items.map((command) => {
                    flatIndex += 1;
                    const isSelected = flatIndex === selectedIndex;
                    const Icon = command.icon;
                    const commandIndex = flatIndex;

                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => command.action()}
                        onMouseEnter={() => setSelectedIndex(commandIndex)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-infra-bg' : 'hover:bg-infra-bg/50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-400' : 'text-infra-muted'}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium ${isSelected ? 'text-infra-text' : 'text-infra-muted'}`}>
                            {command.label}
                          </div>
                          <div className="truncate text-xs text-infra-muted/60">{command.description}</div>
                        </div>
                        {isSelected ? <ChevronRight className="h-3 w-3 shrink-0 text-infra-muted" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-infra-border bg-infra-bg/50 px-4 py-2">
              <div className="flex items-center gap-3 text-[10px] text-infra-muted">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
              <span className="text-[10px] text-infra-muted/50">VitalCV command palette</span>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
