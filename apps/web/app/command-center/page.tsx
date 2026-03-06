'use client';

/**
 * Command Center — Wave 93: Live Wire
 *
 * Route: /command-center
 *
 * Left: System modules. Center: Trust Graph + Terminal.
 * Right: Alerts (live), Decision Insights (live).
 *
 * Each panel independently polls its own backend endpoint.
 * Loading and error states are surfaced per-panel.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { TrustStatusIndicator, type TrustStatus } from '@/components/system/TrustStatusIndicator';
import { TrustEngineTerminal } from '@/components/simulation/TrustEngineTerminal';
import { DecisionInsightsPanel } from '@/components/decision/DecisionInsightsPanel';
import { AlertStream } from '@/components/monitoring/AlertStream';
import { SimulationControlPanel } from '@/components/simulation/SimulationControlPanel';
import { useAlertStream } from '@/hooks/useAlertStream';
import { useDecisionInsights } from '@/hooks/useDecisionInsights';
import { useSystemStatus } from '@/hooks/useSystemStatus';

// ── Types ─────────────────────────────────────────────────────────────

type ModuleId = 'pipeline' | 'simulation' | 'insights';

const MODULES: Array<{ id: ModuleId; label: string; icon: string }> = [
  { id: 'pipeline',   label: 'Pipeline',   icon: '▸' },
  { id: 'simulation', label: 'Simulation', icon: '◎' },
  { id: 'insights',   label: 'Insights',   icon: '◆' },
];

const fadeUp = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Live Status Dot ───────────────────────────────────────────────────

function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
  );
}

// ── Component ─────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const [npiInput, setNpiInput] = useState('');
  const [npi, setNpi] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('pipeline');

  // ── Live data hooks (each independently polls) ─────────────────────

  // System-wide status (no NPI required) — 30s
  const { data: systemStatus } = useSystemStatus(30_000);

  // Alert stream (no NPI required) — 15s
  const {
    data: alerts,
    loading: alertsLoading,
    error: alertsError,
    refresh: refreshAlerts,
    lastUpdated: alertsUpdated,
  } = useAlertStream(15_000);

  // Decision insights (NPI-scoped) — 30s
  const {
    data: insights,
    loading: insightsLoading,
    error: insightsError,
    refresh: refreshInsights,
    lastUpdated: insightsUpdated,
  } = useDecisionInsights(npi, 30_000);

  // ── Derived ───────────────────────────────────────────────────────

  const trustStatus: TrustStatus =
    systemStatus?.overall === 'OPERATIONAL'
      ? 'HEALTHY'
      : systemStatus?.overall === 'DEGRADED'
        ? 'DEGRADED'
        : systemStatus
          ? 'CRITICAL'
          : 'HEALTHY';

  const summary = systemStatus
    ? {
        totalNodes:     systemStatus.artifactIntegrity.total,
        criticalAlerts: alerts.filter((a) => a.severity === 'CRITICAL').length,
        activeRisks:    insights?.insights?.length ?? 0,
        readiness:      insights?.readiness ?? 'UNKNOWN',
      }
    : null;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = npiInput.trim();
    if (/^\d{10}$/.test(trimmed)) setNpi(trimmed);
  }, [npiInput]);

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const isLive = !!alertsUpdated;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ── */}
      <motion.header
        {...fadeUp}
        className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold">Command Center</h1>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <LiveDot connected={isLive} />
              {isLive ? 'Live — polling every 15s' : 'Connecting…'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={npiInput}
            onChange={(e) => setNpiInput(e.target.value)}
            placeholder="Enter NPI"
            maxLength={10}
            className="bg-white/[0.05] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-48"
          />
          <button
            type="submit"
            disabled={!/^\d{10}$/.test(npiInput.trim())}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            Load
          </button>
        </form>
      </motion.header>

      {!npi ? (
        /* ── Empty State ── */
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <motion.div {...fadeUp} className="text-center max-w-md">
            <div className="text-5xl mb-4 opacity-20">⬡</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Command Center</h2>
            <p className="text-sm text-zinc-500">
              Enter a clinician NPI above to load the trust operations dashboard.
              Alerts are already streaming live in the right panel.
            </p>
          </motion.div>
        </div>
      ) : (
        /* ── Main Layout ── */
        <div className="flex h-[calc(100vh-73px)]">

          {/* Left — Module Nav */}
          <motion.aside
            {...fadeUp}
            className="w-48 border-r border-zinc-800 p-4 flex-shrink-0"
          >
            {summary && (
              <TrustStatusIndicator status={trustStatus} summary={summary} className="mb-4" />
            )}
            <div className="space-y-1">
              {MODULES.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                    activeModule === mod.id
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] text-zinc-400'
                  }`}
                >
                  <span>{mod.icon}</span>
                  <span>{mod.label}</span>
                  {mod.id === 'insights' && insightsUpdated && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </motion.aside>

          {/* Center — Active Module */}
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="flex-1 overflow-y-auto p-4"
          >
            <AnimatePresence mode="wait">
              {activeModule === 'pipeline' && (
                <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TrustEngineTerminal npi={npi} />
                </motion.div>
              )}
              {activeModule === 'simulation' && (
                <motion.div key="simulation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <SimulationControlPanel npi={npi} />
                </motion.div>
              )}
              {activeModule === 'insights' && (
                <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {insightsError ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-400">
                      Failed to load decision insights: {insightsError}
                      <button onClick={refreshInsights} className="ml-3 underline text-xs">Retry</button>
                    </div>
                  ) : (
                    <DecisionInsightsPanel
                      data={insights}
                      loading={insightsLoading && !insights}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right — Alerts + Quick Actions */}
          <motion.aside
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="w-72 border-l border-zinc-800 overflow-y-auto p-4 flex-shrink-0 space-y-4"
          >
            {/* Alert Stream header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  {alertsError
                    ? <WifiOff className="h-3 w-3 text-red-400" />
                    : <Wifi className="h-3 w-3 text-emerald-400" />
                  }
                  Alerts
                  {criticalCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[9px] font-bold">
                      {criticalCount} CRITICAL
                    </span>
                  )}
                </h3>
                <button
                  onClick={refreshAlerts}
                  disabled={alertsLoading}
                  className="rounded p-1 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
                  title="Refresh alerts"
                >
                  <RefreshCw className={`h-3 w-3 text-zinc-500 ${alertsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {alertsError ? (
                <div className="text-[11px] text-red-400 px-2">
                  {alertsError}
                  <button onClick={refreshAlerts} className="ml-2 underline text-zinc-500">Retry</button>
                </div>
              ) : (
                <AlertStream alerts={alerts} loading={alertsLoading && alerts.length === 0} />
              )}

              {alertsUpdated && (
                <p className="text-[9px] text-zinc-700 mt-1 px-1">
                  Updated {alertsUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Quick Actions from decision insights */}
            {insights && insights.actions.length > 0 && (
              <div>
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                  Quick Actions
                  {insightsLoading && (
                    <RefreshCw className="inline-block h-2.5 w-2.5 ml-1.5 animate-spin text-zinc-600" />
                  )}
                </h3>
                <div className="space-y-1">
                  {insights.actions.slice(0, 3).map((act) => (
                    <div key={act.id} className="px-2.5 py-2 rounded-lg bg-white/[0.03] text-[11px] text-zinc-400">
                      {act.action}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </main>
  );
}
