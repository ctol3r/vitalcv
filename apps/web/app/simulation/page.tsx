'use client';

/**
 * SimulationPage — Wave 130: State Machine refactor
 *
 * Blast-radius simulation flow backed by useSimulationMachine().
 * State: IDLE → CONFIGURING → SIMULATING → BLAST_RADIUS_COMPUTED | ERROR
 *
 * UI elements read machine.state.current; no ad-hoc boolean flags.
 */

import { motion } from 'framer-motion';
import { SimulationControlPanel, type SimulationResult } from '@/components/simulation/SimulationControlPanel';
import { TrustEngineTerminal } from '@/components/simulation/TrustEngineTerminal';
import { useSimulationMachine } from '@/lib/state-machines';
import { useState } from 'react';

const STATE_LABELS: Record<string, string> = {
  IDLE: 'Enter an NPI to begin',
  CONFIGURING: 'Ready — choose an event type and run',
  SIMULATING: 'Simulating cascade…',
  BLAST_RADIUS_COMPUTED: 'Blast radius computed',
  ERROR: 'Simulation error',
};

export default function SimulationPage() {
  const sim = useSimulationMachine();
  const [npiInput, setNpiInput] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npiInput.trim()) return;
    sim.send({ type: 'CONFIGURE', payload: npiInput.trim() });
  };

  const handleResult = (r: SimulationResult) => {
    setResult(r);
    sim.send({ type: 'COMPLETE' });
  };

  const handleReset = () => {
    setResult(null);
    sim.send({ type: 'RESET' });
    setNpiInput('');
  };

  // Simulation errors are surfaced via the FAIL event when the component reports them

  const activeNpi = sim.state.context.npi;
  const showPanels = sim.isConfiguring || sim.isSimulating || sim.hasResult;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Event Simulator</h1>
            <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
              sim:{sim.state.current}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            {STATE_LABELS[sim.state.current] ?? 'Simulate credential events and observe cascade effects.'}
          </p>
        </motion.div>

        {/* NPI Input — hidden once configured */}
        {(sim.is('IDLE') || sim.hasError) && (
          <motion.form
            onSubmit={handleLoad}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex gap-3 max-w-md"
          >
            <input
              type="text"
              value={npiInput}
              onChange={(e) => setNpiInput(e.target.value)}
              placeholder="Enter NPI (e.g. 1234567890)"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium hover:bg-violet-500 transition-colors disabled:opacity-40"
              disabled={!npiInput.trim()}
            >
              Load
            </button>
          </motion.form>
        )}

        {/* Simulation panels — shown once CONFIGURING or beyond */}
        {showPanels ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <SimulationControlPanel
              npi={activeNpi}
              onResult={handleResult}
              onReset={handleReset}
            />
            <TrustEngineTerminal npi={activeNpi} />
          </motion.div>
        ) : (
          !sim.hasError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center"
            >
              <p className="text-zinc-600 text-sm">Enter an NPI above to start simulating credential events.</p>
            </motion.div>
          )
        )}

        {/* Error state */}
        {sim.hasError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-center justify-between">
            <p className="text-sm text-red-400">Simulation failed. Check NPI and try again.</p>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              Reset
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
