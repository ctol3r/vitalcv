'use client';

/**
 * Command Center — Substrate Consolidation: Phase 6
 *
 * Expanded operator control surface:
 *   Trust Substrate | Revocation Cascade | Federation Health |
 *   Issuer Trust Scores | Monitoring Alerts | Audit Stream |
 *   Pipeline | Simulation | Insights | Knowledge
 *
 * All panels poll live backend APIs. No mock/demo data.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, RefreshCw, Wifi, WifiOff,
  Shield, AlertTriangle, Network, Award, Activity, TerminalSquare,
  Play, Lightbulb, BookOpen,
} from 'lucide-react';
import { TrustStatusIndicator, type TrustStatus } from '@/components/system/TrustStatusIndicator';
import { TrustEngineTerminal } from '@/components/simulation/TrustEngineTerminal';
import { DecisionInsightsPanel } from '@/components/decision/DecisionInsightsPanel';
import { AlertStream } from '@/components/monitoring/AlertStream';
import { SimulationControlPanel } from '@/components/simulation/SimulationControlPanel';
import { KnowledgeExplorer } from '@/components/knowledge/KnowledgeExplorer';
import { TrustAlertsPanel } from '@/components/alerts/TrustAlertsPanel';
// Phase 6 substrate panels
import { TrustSubstratePanel } from '@/components/substrate/TrustSubstratePanel';
import { RevocationCascadePanel } from '@/components/substrate/RevocationCascadePanel';
import { FederationHealthPanel } from '@/components/substrate/FederationHealthPanel';
import { IssuerTrustScoresPanel } from '@/components/substrate/IssuerTrustScoresPanel';
import { AuditStreamPanel } from '@/components/substrate/AuditStreamPanel';
import { useAlertStream } from '@/hooks/useAlertStream';
import { useDecisionInsights } from '@/hooks/useDecisionInsights';
import { useSystemStatus } from '@/hooks/useSystemStatus';

// ── Types ─────────────────────────────────────────────────────────────

type ModuleId =
  | 'substrate'
  | 'revocation'
  | 'federation'
  | 'issuers'
  | 'audit'
  | 'pipeline'
  | 'simulation'
  | 'insights'
  | 'knowledge';

interface ModuleDef {
  id: ModuleId;
  label: string;
  icon: React.ReactNode;
  requiresNpi?: boolean;
  group: 'substrate' | 'ops';
}

const MODULES: ModuleDef[] = [
  // ── Substrate group (no NPI required)
  { id: 'substrate',   label: 'Trust Substrate',    icon: <Shield className="h-3 w-3" />,        group: 'substrate', requiresNpi: true },
  { id: 'revocation',  label: 'Revocation Cascade', icon: <AlertTriangle className="h-3 w-3" />, group: 'substrate' },
  { id: 'federation',  label: 'Federation Health',  icon: <Network className="h-3 w-3" />,       group: 'substrate' },
  { id: 'issuers',     label: 'Issuer Scores',      icon: <Award className="h-3 w-3" />,         group: 'substrate' },
  { id: 'audit',       label: 'Audit Stream',       icon: <Activity className="h-3 w-3" />,      group: 'substrate' },
  // ── Operations group (NPI-scoped)
  { id: 'pipeline',    label: 'Pipeline',           icon: <TerminalSquare className="h-3 w-3" />, group: 'ops', requiresNpi: true },
  { id: 'simulation',  label: 'Simulation',         icon: <Play className="h-3 w-3" />,           group: 'ops', requiresNpi: true },
  { id: 'insights',    label: 'Insights',           icon: <Lightbulb className="h-3 w-3" />,      group: 'ops', requiresNpi: true },
  { id: 'knowledge',   label: 'Knowledge',          icon: <BookOpen className="h-3 w-3" />,       group: 'ops', requiresNpi: true },
];

const fadeUp = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] text-zinc-700 uppercase tracking-widest px-3 pb-1 pt-3 first:pt-0">{label}</p>
  );
}

// ── Component ─────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const [npiInput, setNpiInput] = useState('');
  const [npi, setNpi] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('substrate');

  // ── Live data hooks ────────────────────────────────────────────────
  const { data: systemStatus } = useSystemStatus(30_000);

  const {
    data: alerts,
    loading: alertsLoading,
    error: alertsError,
    refresh: refreshAlerts,
    lastUpdated: alertsUpdated,
  } = useAlertStream(15_000);

  const {
    data: insights,
    loading: insightsLoading,
    error: insightsError,
    refresh: refreshInsights,
    lastUpdated: insightsUpdated,
  } = useDecisionInsights(npi, 30_000);

  // ── Derived ───────────────────────────────────────────────────────
  const trustStatus: TrustStatus =
    systemStatus?.overall === 'OPERATIONAL' ? 'HEALTHY'
    : systemStatus?.overall === 'DEGRADED'  ? 'DEGRADED'
    : systemStatus                          ? 'CRITICAL'
    : 'HEALTHY';

  const summary = systemStatus ? {
    totalNodes:     systemStatus.artifactIntegrity.total,
    criticalAlerts: alerts.filter((a) => a.severity === 'CRITICAL').length,
    activeRisks:    insights?.insights?.length ?? 0,
    readiness:      insights?.readiness ?? 'UNKNOWN',
  } : null;

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const isLive = !!alertsUpdated;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = npiInput.trim();
    if (/^\d{10}$/.test(trimmed)) {
      setNpi(trimmed);
      // Auto-switch to substrate panel when NPI loaded
      setActiveModule('substrate');
    }
  }, [npiInput]);

  const activeModuleDef = MODULES.find((m) => m.id === activeModule)!;
  const needsNpi = activeModuleDef.requiresNpi && !npi;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ── */}
      <motion.header
        {...fadeUp}
        className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-lg font-semibold">Command Center</h1>
          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
            <LiveDot connected={isLive} />
            {isLive ? 'Live — polling every 15s' : 'Connecting…'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={npiInput}
            onChange={(e) => setNpiInput(e.target.value)}
            placeholder="NPI for clinician scope"
            maxLength={10}
            className="bg-white/[0.05] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-52"
          />
          <button
            type="submit"
            disabled={!/^\d{10}$/.test(npiInput.trim())}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            Load
          </button>
          {npi && (
            <button
              type="button"
              onClick={() => { setNpi(null); setNpiInput(''); setActiveModule('substrate'); }}
              className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-600 rounded-lg text-xs text-zinc-500 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </motion.header>

      {/* ── Main Layout ── */}
      <div className="flex h-[calc(100vh-73px)]">

        {/* Left — Module Nav */}
        <motion.aside
          {...fadeUp}
          className="w-48 border-r border-zinc-800 p-3 flex-shrink-0 overflow-y-auto"
        >
          {summary && (
            <div className="mb-3">
              <TrustStatusIndicator status={trustStatus} summary={summary} />
            </div>
          )}

          <SectionLabel label="Substrate" />
          <div className="space-y-0.5 mb-1">
            {MODULES.filter((m) => m.group === 'substrate').map((mod) => (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                  activeModule === mod.id
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'hover:bg-white/[0.04] text-zinc-400'
                }`}
              >
                <span className="text-zinc-500">{mod.icon}</span>
                <span>{mod.label}</span>
              </button>
            ))}
          </div>

          <SectionLabel label="Operations" />
          <div className="space-y-0.5">
            {MODULES.filter((m) => m.group === 'ops').map((mod) => (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                disabled={mod.requiresNpi && !npi}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeModule === mod.id
                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                    : 'hover:bg-white/[0.04] text-zinc-400'
                }`}
              >
                <span className="text-zinc-500">{mod.icon}</span>
                <span>{mod.label}</span>
                {mod.id === 'insights' && insightsUpdated && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
              </button>
            ))}
          </div>

          {!npi && (
            <p className="text-[9px] text-zinc-700 px-3 pt-3">
              Load an NPI to unlock Operations panels.
            </p>
          )}
        </motion.aside>

        {/* Center — Active Module */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="flex-1 overflow-y-auto p-5"
        >
          {needsNpi ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-xs">
                <div className="text-4xl mb-3 opacity-20">⬡</div>
                <p className="text-sm text-zinc-500">
                  Enter a 10-digit NPI above to activate <strong className="text-zinc-400">{activeModuleDef.label}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ── Substrate panels ── */}
              {activeModule === 'substrate' && npi && (
                <motion.div key="substrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-4">
                    <h2 className="text-sm font-medium text-zinc-300 mb-0.5">Trust Substrate State</h2>
                    <p className="text-[11px] text-zinc-600">Full L0–L3 trust evaluation for NPI {npi}</p>
                  </div>
                  <TrustSubstratePanel subject={npi} pollIntervalMs={30_000} />
                </motion.div>
              )}

              {activeModule === 'revocation' && (
                <motion.div key="revocation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-4">
                    <h2 className="text-sm font-medium text-zinc-300 mb-0.5">Revocation Cascade</h2>
                    <p className="text-[11px] text-zinc-600">Network-wide revocations and blast-radius analysis</p>
                  </div>
                  <RevocationCascadePanel pollIntervalMs={30_000} />
                </motion.div>
              )}

              {activeModule === 'federation' && (
                <motion.div key="federation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-4">
                    <h2 className="text-sm font-medium text-zinc-300 mb-0.5">Federation Health</h2>
                    <p className="text-[11px] text-zinc-600">Trust chain integrity and peer network health</p>
                  </div>
                  <FederationHealthPanel pollIntervalMs={30_000} />
                </motion.div>
              )}

              {activeModule === 'issuers' && (
                <motion.div key="issuers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-4">
                    <h2 className="text-sm font-medium text-zinc-300 mb-0.5">Issuer Trust Scores</h2>
                    <p className="text-[11px] text-zinc-600">Registry-wide issuer reputation and HAIP compliance</p>
                  </div>
                  <IssuerTrustScoresPanel pollIntervalMs={60_000} />
                </motion.div>
              )}

              {activeModule === 'audit' && (
                <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-4">
                    <h2 className="text-sm font-medium text-zinc-300 mb-0.5">Audit Stream</h2>
                    <p className="text-[11px] text-zinc-600">Append-only ledger — live event stream with SIEM export</p>
                  </div>
                  <AuditStreamPanel pollIntervalMs={15_000} />
                </motion.div>
              )}

              {/* ── Operations panels ── */}
              {activeModule === 'pipeline' && npi && (
                <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TrustEngineTerminal npi={npi} />
                </motion.div>
              )}

              {activeModule === 'simulation' && npi && (
                <motion.div key="simulation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <SimulationControlPanel npi={npi} />
                </motion.div>
              )}

              {activeModule === 'insights' && npi && (
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

              {activeModule === 'knowledge' && npi && (
                <motion.div key="knowledge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <KnowledgeExplorer npi={npi} pollIntervalMs={60_000} />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>

        {/* Right — Live Alerts Sidebar */}
        <motion.aside
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="w-72 border-l border-zinc-800 overflow-y-auto p-4 flex-shrink-0 space-y-4"
        >
          {/* Monitoring Alerts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                {alertsError
                  ? <WifiOff className="h-3 w-3 text-red-400" />
                  : <Wifi className="h-3 w-3 text-emerald-400" />
                }
                Monitoring Alerts
                {criticalCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[9px] font-bold">
                    {criticalCount}
                  </span>
                )}
              </h3>
              <button
                onClick={refreshAlerts}
                disabled={alertsLoading}
                className="rounded p-1 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
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

          {/* Trust Alerts */}
          <div>
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bell className="h-3 w-3 text-amber-400" />
              Trust Alerts
            </h3>
            <TrustAlertsPanel
              dark
              limit={5}
              pollIntervalMs={30_000}
              className="text-xs"
            />
          </div>

          {/* Quick Actions (NPI-scoped, from Decision Insights) */}
          {npi && insights && insights.actions.length > 0 && (
            <div>
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                Quick Actions
                {insightsLoading && (
                  <RefreshCw className="h-2.5 w-2.5 ml-1 animate-spin text-zinc-600" />
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
    </main>
  );
}
