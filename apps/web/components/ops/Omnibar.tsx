'use client';

/**
 * Omnibar.tsx — Wave 156: Global Command Palette
 *
 * Palantir-grade command surface with keyboard-driven navigation.
 * Activated via Cmd+K / Ctrl+K. Searches NPIs, triggers actions,
 * navigates to any surface.
 *
 * Uses cmdk/Radix-style patterns without external deps.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Stethoscope, Activity, Download, AlertTriangle,
  Shield, Terminal, FileText, Globe2, ChevronRight, X,
  Zap, Users, Building2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OmniCommand {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
  group: string;
  action: () => void;
  keywords: string[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Omnibar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const navigate = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  }, [router]);

  const commands: OmniCommand[] = useMemo(() => [
    // Navigation
    { id: 'nav-mission', label: 'Mission Ops', description: 'Trust network operations center', icon: Terminal, group: 'Navigation', action: () => navigate('/mission-ops'), keywords: ['mission', 'ops', 'operations', 'dashboard'] },
    { id: 'nav-status', label: 'System Status', description: 'Infrastructure health + telemetry', icon: Activity, group: 'Navigation', action: () => navigate('/status'), keywords: ['status', 'health', 'system'] },
    { id: 'nav-network', label: 'Trust Network', description: 'Global trust graph visualization', icon: Globe2, group: 'Navigation', action: () => navigate('/network'), keywords: ['network', 'graph', 'trust', 'map'] },
    { id: 'nav-command', label: 'Command Center', description: 'Operator command console', icon: Shield, group: 'Navigation', action: () => navigate('/command-center'), keywords: ['command', 'center', 'console'] },
    { id: 'nav-developers', label: 'Developers', description: 'API docs + SDK references', icon: FileText, group: 'Navigation', action: () => navigate('/developers'), keywords: ['developers', 'docs', 'api', 'sdk'] },
    { id: 'nav-analytics', label: 'Analytics', description: 'Credential + verification metrics', icon: Activity, group: 'Navigation', action: () => navigate('/analytics'), keywords: ['analytics', 'metrics', 'charts'] },
    { id: 'nav-holder', label: 'Holder Dashboard', description: 'Clinician credential wallet', icon: Stethoscope, group: 'Navigation', action: () => navigate('/holder'), keywords: ['holder', 'wallet', 'clinician'] },
    { id: 'nav-verifier', label: 'Verifier Dashboard', description: 'Credential verification hub', icon: Shield, group: 'Navigation', action: () => navigate('/verifier'), keywords: ['verifier', 'verify', 'check'] },
    // Actions
    { id: 'act-search-npi', label: 'Search NPI', description: 'Look up a provider by NPI number', icon: Search, group: 'Actions', action: () => navigate('/verify/search'), keywords: ['search', 'npi', 'provider', 'lookup'] },
    { id: 'act-simulation', label: 'Run Simulation', description: 'Trust graph simulation engine', icon: Zap, group: 'Actions', action: () => navigate('/simulation'), keywords: ['simulation', 'simulate', 'test'] },
    { id: 'act-export', label: 'Export Directory', description: 'Download provider directory (FHIR/CSV)', icon: Download, group: 'Actions', action: () => navigate('/mission-ops'), keywords: ['export', 'directory', 'download', 'fhir', 'csv'] },
    { id: 'act-alerts', label: 'View Alerts', description: 'Trust network alerts + incidents', icon: AlertTriangle, group: 'Actions', action: () => navigate('/command-center'), keywords: ['alerts', 'incidents', 'warnings'] },
    // Entities
    { id: 'ent-issuers', label: 'Trusted Issuers', description: 'Browse issuer registry', icon: Building2, group: 'Entities', action: () => navigate('/mission-ops'), keywords: ['issuers', 'registry', 'trusted'] },
    { id: 'ent-payers', label: 'Payer Network', description: 'Insurance payer integrations', icon: Users, group: 'Entities', action: () => navigate('/mission-ops'), keywords: ['payers', 'insurance', 'network'] },
  ], [navigate]);

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q)),
    );
  }, [commands, query]);

  // Group commands
  const grouped = useMemo(() => {
    const groups = new Map<string, OmniCommand[]>();
    for (const cmd of filtered) {
      if (!groups.has(cmd.group)) groups.set(cmd.group, []);
      groups.get(cmd.group)!.push(cmd);
    }
    return groups;
  }, [filtered]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation within the palette
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, selectedIndex]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="omnibar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            key="omnibar-palette"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[9999] rounded-2xl border border-infra-border bg-infra-surface shadow-2xl overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-infra-border">
              <Search className="h-4 w-4 text-infra-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, pages, NPIs…"
                className="flex-1 bg-transparent text-sm text-infra-text placeholder-infra-muted/50 outline-none"
                spellCheck={false}
                autoComplete="off"
              />
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-infra-bg border border-infra-border text-[10px] text-infra-muted font-mono">
                  esc
                </kbd>
                <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-infra-bg transition-colors">
                  <X className="h-3.5 w-3.5 text-infra-muted" />
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-infra-muted">
                  No matching commands
                </div>
              )}

              {[...grouped.entries()].map(([group, cmds]) => (
                <div key={group}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-infra-muted uppercase tracking-widest bg-infra-bg/50">
                    {group}
                  </div>
                  {cmds.map((cmd) => {
                    flatIndex++;
                    const isSelected = flatIndex === selectedIndex;
                    const idx = flatIndex;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => cmd.action()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-infra-bg' : 'hover:bg-infra-bg/50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-400' : 'text-infra-muted'}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${isSelected ? 'text-infra-text' : 'text-infra-muted'}`}>
                            {cmd.label}
                          </div>
                          <div className="text-xs text-infra-muted/60 truncate">{cmd.description}</div>
                        </div>
                        {isSelected && <ChevronRight className="h-3 w-3 text-infra-muted shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-infra-border bg-infra-bg/50">
              <div className="flex items-center gap-3 text-[10px] text-infra-muted">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
              <span className="text-[10px] text-infra-muted/50">VitalCV Omnibar</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
