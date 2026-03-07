'use client';

/**
 * SimulationPage — Wave 128: Credential Event Simulator
 *
 * Interactive page for simulating credential events (revocation, expiration,
 * issuer trust changes) and observing cascade effects.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SimulationControlPanel, type SimulationResult } from '@/components/simulation/SimulationControlPanel';
import { TrustEngineTerminal } from '@/components/simulation/TrustEngineTerminal';

export default function SimulationPage() {
  const [npi, setNpi] = useState('');
  const [activeNpi, setActiveNpi] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (npi.trim()) setActiveNpi(npi.trim());
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold tracking-tight">Event Simulator</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
            Simulate credential events and observe cascade effects across the trust network.
            Enter an NPI to begin.
          </p>
        </motion.div>

        {/* NPI Input */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex gap-3 max-w-md"
        >
          <input
            type="text"
            value={npi}
            onChange={(e) => setNpi(e.target.value)}
            placeholder="Enter NPI (e.g. 1234567890)"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium hover:bg-violet-500 transition-colors"
          >
            Load
          </button>
        </motion.form>

        {/* Simulation Panels */}
        {activeNpi ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <SimulationControlPanel
              npi={activeNpi}
              onResult={setResult}
              onReset={handleReset}
            />
            <TrustEngineTerminal npi={activeNpi} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center"
          >
            <p className="text-zinc-600 text-sm">Enter an NPI above to start simulating credential events.</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
