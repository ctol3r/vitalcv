'use client';

/**
 * TrustEngineTerminal.tsx — Trust Engine Pipeline Simulator
 *
 * Animated terminal showing the canonical trust verification pipeline:
 * NPI → NPPES → OIG/LEIE → Nursys (state boards) → Sign
 *
 * M1: NPDB is not integrated. Do not add it back without a live adapter.
 * Only NPPES and OIG/LEIE are always-on. Nursys is gated (institutional access).
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  label: string;
  source: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  detail?: string;
  duration: number; // ms to simulate
}

interface TrustEngineTerminalProps {
  npi?: string;
  onComplete?: (results: PipelineStep[]) => void;
  className?: string;
}

// ── Pipeline Definition ───────────────────────────────────────────────

// M1: Pipeline steps must match live-integrated sources only.
// NPDB removed (not integrated). Nursys shown as gated (requires institutional access).
// "Anchor" step produces a signed ES256 bundle, not a blockchain Merkle tree.
function createPipeline(npi: string): PipelineStep[] {
  return [
    { id: 'npi',    label: 'NPI Lookup',              source: 'NPPES Registry',          status: 'pending', duration: 600 },
    { id: 'nppes',  label: 'Provider Enumeration',     source: 'CMS NPPES',               status: 'pending', duration: 800 },
    { id: 'oig',    label: 'OIG Exclusion Scan',       source: 'HHS OIG / LEIE',          status: 'pending', duration: 700 },
    { id: 'nursys', label: 'State Board Verification', source: 'Nursys (gated)',           status: 'pending', duration: 1200 },
    { id: 'sign',   label: 'Credential Bundle Signed', source: `ES256 · NPI:${npi}`,      status: 'pending', duration: 500 },
  ];
}

// ── Status Indicators ─────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  pending: '○',
  running: '◎',
  success: '●',
  warning: '◐',
  error: '✕',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-zinc-600',
  running: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

// ── Component ─────────────────────────────────────────────────────────

export function TrustEngineTerminal({ npi = '0000000000', onComplete, className = '' }: TrustEngineTerminalProps) {
  const [steps, setSteps] = useState<PipelineStep[]>(() => createPipeline(npi));
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setLog((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const runPipeline = useCallback(async () => {
    setRunning(true);
    setLog([]);
    const freshSteps = createPipeline(npi);
    setSteps(freshSteps);

    addLog(`Pipeline initiated for NPI ${npi}`);

    for (let i = 0; i < freshSteps.length; i++) {
      setCurrentIdx(i);
      freshSteps[i].status = 'running';
      setSteps([...freshSteps]);
      addLog(`→ ${freshSteps[i].label} (${freshSteps[i].source})`);

      await new Promise((r) => setTimeout(r, freshSteps[i].duration));

      // Simulate realistic outcomes
      freshSteps[i].status = 'success';
      freshSteps[i].detail = 'VERIFIED';
      setSteps([...freshSteps]);
      addLog(`  ✓ ${freshSteps[i].label}: PASS`);
    }

    addLog(`Pipeline complete — all ${freshSteps.length} checks passed`);
    setRunning(false);
    setCurrentIdx(-1);
    onComplete?.(freshSteps);
  }, [npi, addLog, onComplete]);

  // Auto-run on mount
  useEffect(() => {
    const timer = setTimeout(runPipeline, 300);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${running ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
            Trust Engine Pipeline
          </span>
        </div>
        <button
          onClick={runPipeline}
          disabled={running}
          className="text-[10px] px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-400 font-mono transition-colors"
        >
          {running ? 'Running...' : 'Re-run'}
        </button>
      </div>

      {/* Pipeline Steps */}
      <div className="p-4 space-y-1">
        <AnimatePresence>
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.2 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg font-mono text-[11px] transition-colors ${
                currentIdx === i ? 'bg-blue-500/[0.06] border border-blue-500/20' : 'bg-transparent'
              }`}
            >
              <span className={`${STATUS_COLOR[step.status]} text-sm min-w-[1rem] text-center`}>
                {STATUS_ICON[step.status]}
              </span>
              <span className="text-zinc-300 flex-1">{step.label}</span>
              <span className="text-zinc-600 text-[9px]">{step.source}</span>
              {step.detail && (
                <span className="text-emerald-400 text-[9px] font-bold">{step.detail}</span>
              )}
              {step.status === 'running' && (
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-blue-400 text-[9px]"
                >
                  verifying...
                </motion.span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Log Output */}
      <div className="border-t border-zinc-800 px-4 py-3 max-h-32 overflow-y-auto">
        <motion.div className="space-y-0.5">
          {log.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[9px] font-mono text-zinc-600 leading-relaxed"
            >
              {line}
            </motion.p>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default TrustEngineTerminal;
