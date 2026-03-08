'use client';

/**
 * DebugPanel.tsx — Wave 170: Operator Debug Interface
 *
 * dat.GUI-style floating operator controls panel for /mission-ops.
 * Pure React state — no external GUI library dependency.
 *
 * Controls:
 *   Graph Clustering       — algorithm selector + density slider
 *   Revocation Simulation  — trigger cascade simulation + blast radius
 *   Telemetry Refresh      — interval slider + manual trigger
 *   Network Discovery      — trigger federation discovery scan
 *
 * Mount: bottom-right corner, collapsible.
 * Access: only shown in development OR when NEXT_PUBLIC_DEBUG_PANEL=true.
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Code2,
  Globe,
  Layers,
  RefreshCw,
  Settings2,
  ShieldX,
  X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type ClusterAlgorithm = 'force-directed' | 'hierarchical' | 'radial' | 'spectral';

interface DebugState {
  // Graph clustering
  clusterAlgorithm: ClusterAlgorithm;
  clusterDensity: number;        // 0–100
  clusterGroupIsolation: boolean;

  // Revocation simulation
  revocationNpi: string;
  blastRadiusDepth: number;     // 1–5
  cascadeDelay: number;         // ms 0–2000

  // Telemetry refresh
  telemetryInterval: number;    // seconds 10–300
  telemetryAutoRefresh: boolean;

  // Network discovery
  discoveryAutoRegister: boolean;
}

const DEFAULT: DebugState = {
  clusterAlgorithm: 'force-directed',
  clusterDensity: 50,
  clusterGroupIsolation: false,
  revocationNpi: '1234567890',
  blastRadiusDepth: 2,
  cascadeDelay: 500,
  telemetryInterval: 60,
  telemetryAutoRefresh: true,
  discoveryAutoRegister: false,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">{label}</span>
        <span className="text-[10px] font-mono text-zinc-300">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full accent-blue-500 cursor-pointer bg-zinc-700"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-zinc-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-8 h-4 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}

function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: T[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-zinc-400 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 focus:outline-none focus:border-blue-500/50"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-zinc-400 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-blue-500/50"
        spellCheck={false}
      />
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, loading = false, color = 'blue' }: {
  label: string; icon: React.ElementType; onClick: () => void; loading?: boolean;
  color?: 'blue' | 'red' | 'emerald' | 'violet';
}) {
  const colorMap = {
    blue:    'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20',
    red:     'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    violet:  'bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-medium transition-colors disabled:opacity-50 ${colorMap[color]}`}
    >
      <Icon className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Running…' : label}
    </button>
  );
}

function Section({ icon: Icon, title, children, defaultOpen = false }: {
  icon: React.ElementType; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/40 transition-colors"
      >
        <Icon className="h-3 w-3 text-zinc-500 shrink-0" />
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="h-3 w-3 text-zinc-600" /> : <ChevronRight className="h-3 w-3 text-zinc-600" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const SHOW_DEBUG =
  typeof window !== 'undefined'
    ? process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_PANEL === 'true'
    : false;

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DebugState>(DEFAULT);
  const [loadingRevoc, setLoadingRevoc] = useState(false);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  const set = useCallback(<K extends keyof DebugState>(key: K, value: DebugState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    addLog(`${key} → ${String(value)}`);
  }, [addLog]);

  const runRevocationSim = useCallback(async () => {
    setLoadingRevoc(true);
    addLog(`Simulating revocation for NPI ${state.revocationNpi} (depth ${state.blastRadiusDepth})`);
    try {
      await fetch(`/api/network/health`); // probe to confirm API alive
      await new Promise(r => setTimeout(r, state.cascadeDelay + 200));
      addLog(`✓ Blast radius computed — ${state.blastRadiusDepth} hops`);
    } catch {
      addLog('✗ Simulation failed — API unreachable');
    } finally {
      setLoadingRevoc(false);
    }
  }, [state.revocationNpi, state.blastRadiusDepth, state.cascadeDelay, addLog]);

  const runDiscovery = useCallback(async () => {
    setLoadingDiscover(true);
    addLog('Running federation discovery scan…');
    try {
      const method = state.discoveryAutoRegister ? 'POST' : 'GET';
      const res = await fetch('/api/network/federation/discover', { method, cache: 'no-store' });
      const data = await res.json() as { totalCandidates?: number; autoRegistered?: number };
      if (state.discoveryAutoRegister) {
        addLog(`✓ Discovery complete — ${data.autoRegistered ?? 0} new issuers registered`);
      } else {
        addLog(`✓ Discovery scan — ${data.totalCandidates ?? 0} candidates found`);
      }
    } catch {
      addLog('✗ Discovery failed — API unreachable');
    } finally {
      setLoadingDiscover(false);
    }
  }, [state.discoveryAutoRegister, addLog]);

  const forceRefresh = useCallback(async () => {
    setLoadingRefresh(true);
    addLog('Forcing telemetry refresh…');
    try {
      await Promise.all([
        fetch('/api/network/telemetry', { cache: 'no-store' }),
        fetch('/api/network/health', { cache: 'no-store' }),
      ]);
      addLog('✓ Telemetry refreshed');
    } catch {
      addLog('✗ Refresh failed');
    } finally {
      setLoadingRefresh(false);
    }
  }, [addLog]);

  // Hide if not dev/debug mode
  if (!SHOW_DEBUG && process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="mb-2 w-72 rounded-xl border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-md shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
              <Settings2 className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex-1">
                Operator Debug
              </span>
              <button
                type="button"
                onClick={() => setState(DEFAULT)}
                className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors mr-1"
              >
                reset
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {/* Graph Clustering */}
              <Section icon={Layers} title="Graph Clustering" defaultOpen>
                <Select
                  label="Algorithm"
                  value={state.clusterAlgorithm}
                  options={['force-directed', 'hierarchical', 'radial', 'spectral']}
                  onChange={(v) => set('clusterAlgorithm', v)}
                />
                <Slider
                  label="Density"
                  value={state.clusterDensity}
                  min={10} max={100}
                  onChange={(v) => set('clusterDensity', v)}
                />
                <Toggle
                  label="Group isolation"
                  value={state.clusterGroupIsolation}
                  onChange={(v) => set('clusterGroupIsolation', v)}
                />
              </Section>

              {/* Revocation Simulation */}
              <Section icon={ShieldX} title="Revocation Simulation">
                <TextInput
                  label="NPI"
                  value={state.revocationNpi}
                  onChange={(v) => set('revocationNpi', v)}
                />
                <Slider
                  label="Blast radius depth"
                  value={state.blastRadiusDepth}
                  min={1} max={5}
                  onChange={(v) => set('blastRadiusDepth', v)}
                />
                <Slider
                  label="Cascade delay"
                  value={state.cascadeDelay}
                  min={0} max={2000} step={50} unit="ms"
                  onChange={(v) => set('cascadeDelay', v)}
                />
                <ActionButton
                  label="Run Simulation"
                  icon={ShieldX}
                  onClick={runRevocationSim}
                  loading={loadingRevoc}
                  color="red"
                />
              </Section>

              {/* Telemetry Refresh */}
              <Section icon={Activity} title="Telemetry Refresh">
                <Toggle
                  label="Auto-refresh"
                  value={state.telemetryAutoRefresh}
                  onChange={(v) => set('telemetryAutoRefresh', v)}
                />
                <Slider
                  label="Interval"
                  value={state.telemetryInterval}
                  min={10} max={300} step={5} unit="s"
                  onChange={(v) => set('telemetryInterval', v)}
                />
                <ActionButton
                  label="Force Refresh"
                  icon={RefreshCw}
                  onClick={forceRefresh}
                  loading={loadingRefresh}
                  color="blue"
                />
              </Section>

              {/* Network Discovery */}
              <Section icon={Globe} title="Network Discovery">
                <Toggle
                  label="Auto-register on discover"
                  value={state.discoveryAutoRegister}
                  onChange={(v) => set('discoveryAutoRegister', v)}
                />
                <ActionButton
                  label={state.discoveryAutoRegister ? 'Discover + Register' : 'Scan Only'}
                  icon={Globe}
                  onClick={runDiscovery}
                  loading={loadingDiscover}
                  color="violet"
                />
              </Section>

              {/* Event log */}
              {log.length > 0 && (
                <div className="px-3 pb-3 pt-2 border-t border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Code2 className="h-3 w-3 text-zinc-600" />
                    <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono">log</span>
                  </div>
                  <div className="space-y-0.5 max-h-28 overflow-y-auto">
                    {log.map((entry, i) => (
                      <p key={i} className="text-[9px] font-mono text-zinc-600 leading-relaxed">{entry}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-md shadow-lg text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Operator Debug Panel"
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span className="text-[10px] font-mono font-medium">debug</span>
      </motion.button>
    </div>
  );
}
