'use client';

/**
 * DemoFlow.tsx — Wave 64: Full Unauthenticated Demo Flow
 *
 * NPI → Trust-state terminal → Graph expands → Decision capsule →
 * Revocation simulation → Verifier approval. All simulated data.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

type Phase = 'input' | 'trust-state' | 'graph' | 'decision' | 'revocation' | 'approval' | 'complete';

interface TerminalLine {
  text: string;
  type: 'info' | 'success' | 'error' | 'hash';
}

// ── Constants ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<Phase, { label: string; duration: number }> = {
  'input': { label: 'Enter NPI', duration: 0 },
  'trust-state': { label: 'Loading Trust State', duration: 3000 },
  'graph': { label: 'Building Knowledge Graph', duration: 3500 },
  'decision': { label: 'Generating Decision Capsule', duration: 2500 },
  'revocation': { label: 'Simulating Revocation', duration: 3000 },
  'approval': { label: 'Verifier Approval', duration: 2000 },
  'complete': { label: 'Demo Complete', duration: 0 },
};

const PHASES: Phase[] = ['trust-state', 'graph', 'decision', 'revocation', 'approval', 'complete'];

const TERMINAL_SCRIPTS: Record<string, TerminalLine[]> = {
  'trust-state': [
    { text: '> Fetching trust state for NPI...', type: 'info' },
    { text: '  Medical License: VERIFIED (L3)', type: 'success' },
    { text: '  DEA Registration: VERIFIED (L2)', type: 'success' },
    { text: '  Board Certification: VERIFIED (L3)', type: 'success' },
    { text: '  CRS Score: 87 (GREEN)', type: 'success' },
  ],
  'graph': [
    { text: '> Constructing authority-bound knowledge graph...', type: 'info' },
    { text: '  Nodes: 9 | Edges: 8', type: 'info' },
    { text: '  clinician → credential → issuer', type: 'info' },
    { text: '  credential → decision → employer', type: 'info' },
    { text: '  Graph ready', type: 'success' },
  ],
  'decision': [
    { text: '> Computing decision capsule...', type: 'info' },
    { text: '  Type: HIRING', type: 'info' },
    { text: '  Credential inputs: 4', type: 'info' },
    { text: '  Hash: 0xa7f3c2d1e8b94f06...', type: 'hash' },
    { text: '  Status: VALID ✓', type: 'success' },
  ],
  'revocation': [
    { text: '> Simulating Medical License revocation...', type: 'info' },
    { text: '  ⚡ Cascade: 7 nodes affected', type: 'error' },
    { text: '  ⚡ Depth: 3 hops', type: 'error' },
    { text: '  ⚡ Decisions invalidated: 2', type: 'error' },
    { text: '  Blast radius computed', type: 'info' },
  ],
  'approval': [
    { text: '> Verifier reviewing credential bundle...', type: 'info' },
    { text: '  All PSV checks passed', type: 'success' },
    { text: '  CRS meets threshold (87 ≥ 70)', type: 'success' },
    { text: '  Bundle approved ✓', type: 'success' },
  ],
};

const LINE_COLORS: Record<string, string> = {
  info: 'text-zinc-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
  hash: 'text-amber-400 font-mono',
};

// ── Component ─────────────────────────────────────────────────────────────

export function DemoFlow({ className = '' }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>('input');
  const [npi, setNpi] = useState('9999999999');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const typeLines = useCallback((script: TerminalLine[], onDone: () => void) => {
    let idx = 0;
    function next() {
      if (idx >= script.length) { onDone(); return; }
      setLines((prev) => [...prev, script[idx]]);
      idx++;
      lineTimerRef.current = setTimeout(next, 400);
    }
    next();
  }, []);

  const advancePhase = useCallback((idx: number) => {
    if (idx >= PHASES.length) return;
    const p = PHASES[idx];
    setPhase(p);
    setPhaseIdx(idx);

    if (p === 'complete') return;

    const script = TERMINAL_SCRIPTS[p];
    if (script) {
      typeLines(script, () => {
        const cfg = PHASE_CONFIG[p];
        timerRef.current = setTimeout(() => advancePhase(idx + 1), Math.max(cfg.duration - script.length * 400, 500));
      });
    } else {
      timerRef.current = setTimeout(() => advancePhase(idx + 1), PHASE_CONFIG[p].duration);
    }
  }, [typeLines]);

  const startDemo = useCallback(() => {
    setLines([{ text: `> VitalCV Demo — NPI: ${npi}`, type: 'info' }, { text: '', type: 'info' }]);
    advancePhase(0);
  }, [npi, advancePhase]);

  const restart = useCallback(() => {
    clearTimers();
    setPhase('input');
    setPhaseIdx(-1);
    setLines([]);
  }, [clearTimers]);

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {/* Phase Indicator */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex gap-1 mb-2">
          {PHASES.slice(0, -1).map((p, i) => (
            <div key={p} className="flex-1 h-1 rounded-full overflow-hidden bg-white/[0.06]">
              <motion.div
                className={`h-full rounded-full ${
                  i < phaseIdx ? 'bg-emerald-500' : i === phaseIdx ? 'bg-emerald-400' : ''
                }`}
                animate={{ width: i <= phaseIdx ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-300">{PHASE_CONFIG[phase].label}</p>
          {phase === 'complete' && (
            <button onClick={restart} className="text-[10px] text-zinc-500 hover:text-white transition-colors">↻ Restart</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {phase === 'input' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-[11px] text-zinc-500 mb-3">Enter an NPI to start the demo</p>
            <div className="flex gap-2">
              <input type="text" value={npi} onChange={(e) => setNpi(e.target.value)}
                maxLength={10} placeholder="NPI (10 digits)"
                className="flex-1 bg-white/[0.04] border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono" />
              <button onClick={startDemo} disabled={!/^\d{10}$/.test(npi)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg text-sm font-medium transition-colors">
                Start Demo
              </button>
            </div>
          </motion.div>
        ) : (
          /* Terminal */
          <div className="bg-zinc-900/50 rounded-lg p-4 font-mono text-[11px] max-h-[300px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {lines.map((line, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`${LINE_COLORS[line.type] ?? 'text-zinc-400'} ${line.text === '' ? 'h-2' : ''}`}>
                  {line.text}
                </motion.div>
              ))}
            </AnimatePresence>
            {phase !== 'complete' && (
              <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </div>
        )}

        {/* Complete */}
        {phase === 'complete' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-emerald-400">Demo Complete ✓</p>
            <p className="text-[11px] text-zinc-500 mt-1">Full trust lifecycle demonstrated in real-time</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default DemoFlow;
