'use client';

/**
 * SimulationControlPanel.tsx — Wave 84: Simulation Controls
 *
 * Controls for selecting event type, running simulations,
 * and resetting the graph.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getApiBase } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────

export type SimEventType = 'credential_expired' | 'credential_revoked' | 'credential_added' | 'issuer_revoked';

export interface SimulationResult {
  npi: string;
  eventType: SimEventType;
  affectedDecisions: Array<{ id: string; label: string; newRisk: string }>;
  affectedEmployers: Array<{ id: string; label: string }>;
  cascadeDepth: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  totalAffected: number;
}

interface SimulationControlPanelProps {
  npi: string;
  onResult?: (result: SimulationResult) => void;
  onReset?: () => void;
  className?: string;
}

// ── Event Options ─────────────────────────────────────────────────────

const EVENT_OPTIONS: Array<{ value: SimEventType; label: string; icon: string; desc: string }> = [
  { value: 'credential_revoked', label: 'Credential Revoked', icon: '✕', desc: 'Simulate a credential being revoked by its issuer' },
  { value: 'credential_expired', label: 'Credential Expired', icon: '⏱', desc: 'Simulate a credential reaching expiration' },
  { value: 'issuer_revoked', label: 'Issuer Revoked', icon: '⚡', desc: 'Simulate an issuer losing trust status' },
  { value: 'credential_added', label: 'Credential Added', icon: '+', desc: 'Simulate adding a new verified credential' },
];

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-emerald-400',
  MEDIUM: 'text-amber-400',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

// ── Component ─────────────────────────────────────────────────────────

export function SimulationControlPanel({ npi, onResult, onReset, className = '' }: SimulationControlPanelProps) {
  const [selected, setSelected] = useState<SimEventType>('credential_revoked');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const base = getApiBase();

  const runSimulation = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch(`${base}/api/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'demo-pilot-org-alpha' },
        body: JSON.stringify({ npi, eventType: selected }),
      });
      if (res.ok) {
        const data = (await res.json()) as SimulationResult;
        setResult(data);
        onResult?.(data);
      }
    } finally {
      setRunning(false);
    }
  }, [npi, selected, base, onResult]);

  const handleReset = useCallback(() => {
    setResult(null);
    onReset?.();
  }, [onReset]);

  return (
    <div className={`rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Simulation Controls</h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Event Selector */}
        <div className="space-y-1">
          {EVENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                selected === opt.value
                  ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] text-zinc-400'
              }`}
            >
              <span className="text-sm w-5 text-center">{opt.icon}</span>
              <div className="flex-1">
                <p className="font-medium">{opt.label}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Run / Reset Buttons */}
        <div className="flex gap-2">
          <button
            onClick={runSimulation}
            disabled={running}
            className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-xs font-medium transition-colors"
          >
            {running ? 'Simulating...' : 'Run Simulation'}
          </button>
          {result && (
            <button onClick={handleReset} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 transition-colors">
              Reset
            </button>
          )}
        </div>

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                <p className={`text-lg font-bold ${RISK_COLORS[result.riskLevel]}`}>{result.riskLevel}</p>
                <p className="text-[9px] text-zinc-500">Risk Level</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-zinc-300">{result.totalAffected}</p>
                <p className="text-[9px] text-zinc-500">Nodes Affected</p>
              </div>
            </div>
            {result.affectedDecisions.length > 0 && (
              <div>
                <p className="text-[9px] text-zinc-500 mb-1">Affected Decisions</p>
                {result.affectedDecisions.map((d) => (
                  <p key={d.id} className="text-[10px] text-amber-300">◆ {d.label}</p>
                ))}
              </div>
            )}
            {result.affectedEmployers.length > 0 && (
              <div>
                <p className="text-[9px] text-zinc-500 mb-1">Affected Employers</p>
                {result.affectedEmployers.map((e) => (
                  <p key={e.id} className="text-[10px] text-violet-300">▸ {e.label}</p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default SimulationControlPanel;
