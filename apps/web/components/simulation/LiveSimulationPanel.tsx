'use client';

/**
 * LiveSimulationPanel.tsx — Wave 248: Live Trust Simulation Dashboard
 *
 * Interactive "What if?" simulation engine connected to real credential data,
 * Decision Capsules, and Trust State Engine.
 *
 * Scenarios:
 *   - Credential Revocation: what if NPI X loses their DEA/license/board cert?
 *   - License Expiration: what if a license expires on date Y?
 *   - Compliance Rule: what if we add a new compliance requirement?
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

type SimulationType = 'revocation' | 'expiration' | 'compliance';

interface TrustStateSnapshot {
  readiness_level: string;
  readiness_score: number;
}

interface AffectedCapsule {
  capsuleId: string;
  decisionType: string;
  organization: string;
  status: 'WOULD_INVALIDATE' | 'WOULD_DEGRADE' | 'UNAFFECTED';
}

interface SimulationResult {
  npi: string;
  simulatedRevocation: string;
  currentState: TrustStateSnapshot;
  projectedState: TrustStateSnapshot;
  degradation: number;
  affectedCapsules: AffectedCapsule[];
  affectedOrganizations: string[];
  estimatedImpact: { hospitalsAffected: number; privilegesImpacted: number };
  simulatedAt: string;
}

interface ComplianceResult {
  rule: string;
  specialty?: string;
  state?: string;
  affectedClinicians: number;
  wouldFailCount: number;
  gapSummary: string[];
  simulatedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CREDENTIAL_TYPES = [
  { value: 'state_license', label: 'State Medical License' },
  { value: 'dea', label: 'DEA Registration' },
  { value: 'board_cert', label: 'Board Certification' },
  { value: 'malpractice', label: 'Malpractice Insurance' },
  { value: 'hospital_priv', label: 'Hospital Privileges' },
  { value: 'cds', label: 'CDS Certificate' },
  { value: 'specialty_cert', label: 'Specialty Certification' },
];

const SIM_TYPES: Array<{ value: SimulationType; label: string; icon: string; desc: string }> = [
  { value: 'revocation',  label: 'Credential Revocation', icon: '✕', desc: 'Simulate revoking a specific credential type' },
  { value: 'expiration',  label: 'License Expiration',    icon: '⏱', desc: 'Simulate what happens when a license expires on a given date' },
  { value: 'compliance',  label: 'Compliance Rule',       icon: '⚖', desc: 'Simulate adding a new compliance requirement across all clinicians' },
];

const BAND_COLORS: Record<string, string> = {
  L3: 'text-emerald-400',
  L2: 'text-blue-400',
  L1: 'text-amber-400',
  L0: 'text-red-400',
};

const BAND_BG: Record<string, string> = {
  L3: 'bg-emerald-500/10 border-emerald-500/20',
  L2: 'bg-blue-500/10 border-blue-500/20',
  L1: 'bg-amber-500/10 border-amber-500/20',
  L0: 'bg-red-500/10 border-red-500/20',
};

const CAPSULE_STATUS_COLORS: Record<string, string> = {
  WOULD_INVALIDATE: 'text-red-400 bg-red-500/10',
  WOULD_DEGRADE:    'text-amber-400 bg-amber-500/10',
  UNAFFECTED:       'text-emerald-400 bg-emerald-500/10',
};

const CAPSULE_STATUS_LABELS: Record<string, string> = {
  WOULD_INVALIDATE: 'INVALIDATED',
  WOULD_DEGRADE:    'DEGRADED',
  UNAFFECTED:       'UNAFFECTED',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrustBandCard({ label, state, isProjected = false }: {
  label: string;
  state: TrustStateSnapshot;
  isProjected?: boolean;
}) {
  const band = state.readiness_level ?? 'L0';
  return (
    <div className={`rounded-xl border p-4 ${BAND_BG[band] ?? 'bg-muted border-border'}`}>
      <p className="text-[9px] uppercase tracking-widest font-mono mb-2 text-zinc-500">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold font-mono ${BAND_COLORS[band] ?? 'text-zinc-400'}`}>
          {band}
        </span>
        {isProjected && (
          <span className="text-[10px] text-zinc-600">projected</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              band === 'L3' ? 'bg-emerald-500' :
              band === 'L2' ? 'bg-blue-500' :
              band === 'L1' ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${state.readiness_score}%` }}
          />
        </div>
        <span className={`ml-3 text-xs font-mono font-bold shrink-0 ${BAND_COLORS[band] ?? 'text-zinc-400'}`}>
          {state.readiness_score}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function LiveSimulationPanel({ initialNpi = '' }: { initialNpi?: string }) {
  const [simType, setSimType]           = useState<SimulationType>('revocation');
  const [npi, setNpi]                   = useState(initialNpi);
  const [credentialType, setCredType]   = useState('state_license');
  const [expirationDate, setExpDate]    = useState('');
  const [complianceRule, setRule]       = useState('');
  const [complianceSpec, setSpec]       = useState('');
  const [complianceState, setStateVal]  = useState('');

  const [running, setRunning]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<SimulationResult | null>(null);
  const [compResult, setCompResult]     = useState<ComplianceResult | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setCompResult(null);
    setError(null);
  }, []);

  const runSimulation = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setCompResult(null);

    try {
      if (simType === 'revocation') {
        if (!npi || !credentialType) throw new Error('NPI and credential type are required');
        const res = await fetch('/api/simulation/revocation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npi, credentialType }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        setResult(await res.json() as SimulationResult);

      } else if (simType === 'expiration') {
        if (!npi || !expirationDate) throw new Error('NPI and expiration date are required');
        const res = await fetch('/api/simulation/expiration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npi, expirationDate }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        setResult(await res.json() as SimulationResult);

      } else if (simType === 'compliance') {
        if (!complianceRule) throw new Error('Compliance rule description is required');
        const res = await fetch('/api/simulation/compliance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rule: complianceRule,
            specialty: complianceSpec || undefined,
            state: complianceState || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        setCompResult(await res.json() as ComplianceResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  }, [simType, npi, credentialType, expirationDate, complianceRule, complianceSpec, complianceState]);

  const hasResult = result !== null || compResult !== null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#080e1a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Live Simulation Engine</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">What if? — connected to real credential data</p>
        </div>
        <span className="text-[9px] font-mono text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full border border-violet-500/20">
          WAVE 248
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Scenario Selector */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2 font-mono">Scenario Type</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SIM_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setSimType(t.value); reset(); }}
                className={`text-left p-3 rounded-xl border transition-all text-xs ${
                  simType === t.value
                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                }`}
              >
                <span className="text-base block mb-1">{t.icon}</span>
                <span className="font-medium block">{t.label}</span>
                <span className="text-[9px] opacity-60 mt-0.5 block">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-3">
          <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Parameters</p>

          {/* Revocation */}
          {simType === 'revocation' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">NPI</label>
                <input
                  type="text"
                  value={npi}
                  onChange={(e) => setNpi(e.target.value)}
                  placeholder="1234567890"
                  maxLength={10}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Credential Type</label>
                <select
                  value={credentialType}
                  onChange={(e) => setCredType(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#080e1a] px-3 py-2 text-sm text-foreground focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                >
                  {CREDENTIAL_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Expiration */}
          {simType === 'expiration' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">NPI</label>
                <input
                  type="text"
                  value={npi}
                  onChange={(e) => setNpi(e.target.value)}
                  placeholder="1234567890"
                  maxLength={10}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#080e1a] px-3 py-2 text-sm text-foreground focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {/* Compliance */}
          {simType === 'compliance' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Compliance Rule</label>
                <textarea
                  value={complianceRule}
                  onChange={(e) => setRule(e.target.value)}
                  placeholder="e.g. All clinicians must have active board certification and DEA registration"
                  rows={2}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Specialty (optional)</label>
                  <input
                    type="text"
                    value={complianceSpec}
                    onChange={(e) => setSpec(e.target.value)}
                    placeholder="e.g. Anesthesiology"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">State (optional)</label>
                  <input
                    type="text"
                    value={complianceState}
                    onChange={(e) => setStateVal(e.target.value)}
                    placeholder="e.g. CA"
                    maxLength={2}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Run Button */}
        <div className="flex gap-3">
          <button
            onClick={runSimulation}
            disabled={running}
            className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {running ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                Simulating…
              </>
            ) : (
              <>▶ Run Simulation</>
            )}
          </button>
          {hasResult && (
            <button
              onClick={reset}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-400 transition-colors border border-white/[0.06]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}

        {/* ── Results: Revocation / Expiration ────────────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4 border-t border-white/[0.06] pt-5"
            >
              {/* Current vs Projected */}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-3 font-mono">Trust State Impact</p>
                <div className="grid grid-cols-2 gap-3 items-start">
                  <TrustBandCard label="Current State" state={result.currentState} />
                  <div className="flex flex-col gap-3">
                    <div className="hidden sm:flex items-center justify-center text-zinc-600">
                      {result.degradation > 0 ? (
                        <span className="text-red-400 text-xl">↓</span>
                      ) : (
                        <span className="text-emerald-400 text-xl">→</span>
                      )}
                    </div>
                    <TrustBandCard label="Projected State" state={result.projectedState} isProjected />
                  </div>
                </div>

                {result.degradation > 0 && (
                  <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/15 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-red-400/80">Score degradation</span>
                    <span className="text-lg font-bold font-mono text-red-400">−{result.degradation}</span>
                  </div>
                )}
              </div>

              {/* Impact Summary */}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2 font-mono">Estimated Impact</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-amber-400">
                      {result.estimatedImpact.hospitalsAffected}
                    </p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Hospitals Affected</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-red-400">
                      {result.estimatedImpact.privilegesImpacted}
                    </p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Privileges Impacted</p>
                  </div>
                </div>
              </div>

              {/* Affected Organizations */}
              {result.affectedOrganizations.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2 font-mono">Affected Organizations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.affectedOrganizations.map((org) => (
                      <span
                        key={org}
                        className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono"
                      >
                        {org}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Capsule Impact Table */}
              {result.affectedCapsules.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2 font-mono">
                    Decision Capsule Impact ({result.affectedCapsules.length})
                  </p>
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          <th className="px-3 py-2 text-left font-mono text-[9px] uppercase text-zinc-600">Capsule</th>
                          <th className="px-3 py-2 text-left font-mono text-[9px] uppercase text-zinc-600">Type</th>
                          <th className="px-3 py-2 text-left font-mono text-[9px] uppercase text-zinc-600">Organization</th>
                          <th className="px-3 py-2 text-right font-mono text-[9px] uppercase text-zinc-600">Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.affectedCapsules.map((capsule) => (
                          <tr
                            key={capsule.capsuleId}
                            className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-3 py-2 font-mono text-[10px] text-zinc-400">
                              {capsule.capsuleId.slice(0, 8)}…
                            </td>
                            <td className="px-3 py-2 text-zinc-300">{capsule.decisionType}</td>
                            <td className="px-3 py-2 text-zinc-400 text-[10px]">{capsule.organization}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-semibold ${CAPSULE_STATUS_COLORS[capsule.status]}`}>
                                {CAPSULE_STATUS_LABELS[capsule.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No capsules */}
              {result.affectedCapsules.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                  <p className="text-xs text-zinc-600">No Decision Capsules found for this clinician</p>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-[9px] text-zinc-700 font-mono text-right">
                simulated at {new Date(result.simulatedAt).toLocaleTimeString()}
              </p>
            </motion.div>
          )}

          {/* ── Results: Compliance ─────────────────────────────────────────────── */}
          {compResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4 border-t border-white/[0.06] pt-5"
            >
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Compliance Impact Analysis</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-blue-400">{compResult.affectedClinicians}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Clinicians in System</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-red-400">{compResult.wouldFailCount}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Would Fail</p>
                </div>
              </div>

              {compResult.gapSummary.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2 font-mono">Gap Summary</p>
                  <div className="space-y-1.5">
                    {compResult.gapSummary.map((gap, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-zinc-400 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]"
                      >
                        <span className="text-amber-500 mt-0.5 shrink-0">◆</span>
                        {gap}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[9px] text-zinc-700 font-mono text-right">
                simulated at {new Date(compResult.simulatedAt).toLocaleTimeString()}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LiveSimulationPanel;
