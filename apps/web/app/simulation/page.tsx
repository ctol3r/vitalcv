'use client';

/**
 * SimulationPage — Wave 248: Live Trust Simulation Engine
 *
 * Primary view: LiveSimulationPanel (real credential data, Decision Capsules,
 * Trust State Engine).
 * Secondary view: Legacy graph-based EventSimulator (tabbed).
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { LiveSimulationPanel } from '@/components/simulation/LiveSimulationPanel';
import { SimulationControlPanel, type SimulationResult } from '@/components/simulation/SimulationControlPanel';
import { TrustEngineTerminal } from '@/components/simulation/TrustEngineTerminal';
import { useSimulationMachine } from '@/lib/state-machines';

type Tab = 'live' | 'legacy';

const TAB_LABELS: Record<Tab, string> = {
  live:   'Live Simulation',
  legacy: 'Event Simulator',
};

function DemoBanner() {
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-center">
      <p className="text-[11px] font-medium text-amber-400/80">
        Demo environment - data shown is not real credential verification
      </p>
    </div>
  );
}

// ── Legacy panel wrapper (preserves old state machine flow) ──────────────────

function LegacySimulationView() {
  const sim = useSimulationMachine();
  const [npiInput, setNpiInput] = useState('');
  const [, setResult] = useState<SimulationResult | null>(null);

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

  const activeNpi = sim.state.context.npi;
  const showPanels = sim.isConfiguring || sim.isSimulating || sim.hasResult;

  return (
    <div className="space-y-6">
      <div className="text-sm text-zinc-500">
        Legacy graph-based simulator — visualises cascade depth and affected graph nodes.
      </div>

      {(sim.is('IDLE') || sim.hasError) && (
        <form onSubmit={handleLoad} className="flex gap-3 max-w-md">
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
        </form>
      )}

      {showPanels ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimulationControlPanel npi={activeNpi} onResult={handleResult} onReset={handleReset} />
          <TrustEngineTerminal npi={activeNpi} />
        </div>
      ) : (
        !sim.hasError && (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center">
            <p className="text-zinc-600 text-sm">Enter an NPI above to start simulating credential events.</p>
          </div>
        )
      )}

      {sim.hasError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-center justify-between">
          <p className="text-sm text-red-400">Simulation failed. Check NPI and try again.</p>
          <button type="button" onClick={handleReset} className="text-xs text-zinc-400 hover:text-white underline">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('live');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#080e1a] to-slate-950 text-white">
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Trust Simulation Engine</h1>
              <p className="mt-1.5 text-sm text-zinc-400 max-w-2xl">
                Operational intelligence for healthcare credentialing in a demo environment - simulate
                credential revocation, license expiration, and compliance scenarios before they happen.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              demo scenarios
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mt-6 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
            {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {activeTab === 'live' ? (
            <LiveSimulationPanel />
          ) : (
            <LegacySimulationView />
          )}
        </motion.div>
      </main>
    </div>
  );
}
