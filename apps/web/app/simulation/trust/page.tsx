'use client';

/**
 * Trust Simulation — Bonus Feature 1
 *
 * Route: /simulation/trust
 * Options: simulate revocation, addition, employer subscription.
 * Graph animates cascade impact.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

type SimAction = 'revoke' | 'add' | 'subscribe';

interface SimNode {
  id: string; label: string; group: string;
  affected: boolean; added: boolean;
}

interface SimResult {
  action: SimAction;
  affectedCount: number;
  description: string;
  nodes: SimNode[];
}

// ── Demo Network ──────────────────────────────────────────────────────────

const BASE_NODES: SimNode[] = [
  { id: 'clinician', label: 'Dr. Smith', group: 'clinician', affected: false, added: false },
  { id: 'cred-license', label: 'Medical License', group: 'credential', affected: false, added: false },
  { id: 'cred-dea', label: 'DEA Registration', group: 'credential', affected: false, added: false },
  { id: 'cred-board', label: 'Board Cert', group: 'credential', affected: false, added: false },
  { id: 'issuer-board', label: 'State Board', group: 'issuer', affected: false, added: false },
  { id: 'employer-hosp', label: 'Memorial Hospital', group: 'employer', affected: false, added: false },
  { id: 'decision-hire', label: 'Hiring Decision', group: 'decision', affected: false, added: false },
];

const EDGES = [
  { from: 'clinician', to: 'cred-license' },
  { from: 'clinician', to: 'cred-dea' },
  { from: 'clinician', to: 'cred-board' },
  { from: 'cred-license', to: 'issuer-board' },
  { from: 'cred-license', to: 'decision-hire' },
  { from: 'decision-hire', to: 'employer-hosp' },
];

// ── Simulation Logic ──────────────────────────────────────────────────────

function runSimulation(action: SimAction): SimResult {
  const nodes = BASE_NODES.map((n) => ({ ...n }));

  if (action === 'revoke') {
    const cascade = new Set(['cred-license', 'issuer-board', 'decision-hire', 'employer-hosp']);
    for (const n of nodes) if (cascade.has(n.id)) n.affected = true;
    return { action, affectedCount: cascade.size, description: 'Medical License revoked — cascade through decision to employer', nodes };
  }

  if (action === 'add') {
    const newNode: SimNode = { id: 'cred-new', label: 'Fellowship Cert', group: 'credential', affected: false, added: true };
    nodes.push(newNode);
    return { action, affectedCount: 1, description: 'Fellowship Certification added — strengthens CRS score', nodes };
  }

  // subscribe
  const newEmployer: SimNode = { id: 'employer-new', label: 'Unity Health', group: 'employer', affected: false, added: true };
  nodes.push(newEmployer);
  return { action, affectedCount: 1, description: 'Unity Health subscribed — new trust relationship established', nodes };
}

// ── Constants ─────────────────────────────────────────────────────────────

const ACTIONS: Array<{ id: SimAction; label: string; icon: string; color: string }> = [
  { id: 'revoke', label: 'Revoke Credential', icon: '⚡', color: 'bg-red-600 hover:bg-red-500' },
  { id: 'add', label: 'Add Credential', icon: '＋', color: 'bg-emerald-600 hover:bg-emerald-500' },
  { id: 'subscribe', label: 'Employer Subscribe', icon: '◎', color: 'bg-violet-600 hover:bg-violet-500' },
];

const GROUP_COLORS: Record<string, string> = {
  clinician: '#228B22', credential: '#DAA520', issuer: '#4A90D9',
  employer: '#8B5CF6', decision: '#F97316',
};

const SIZE = 340;
const CTR = SIZE / 2;
const RAD = 130;

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function TrustSimulationPage() {
  const [result, setResult] = useState<SimResult | null>(null);

  const handleAction = useCallback((action: SimAction) => {
    setResult(runSimulation(action));
  }, []);

  const positions = useMemo(() => {
    const nodes = result?.nodes ?? BASE_NODES;
    const map = new Map<string, { x: number; y: number }>();
    const clinician = nodes.find((n) => n.group === 'clinician');
    const others = nodes.filter((n) => n.group !== 'clinician');

    if (clinician) map.set(clinician.id, { x: CTR, y: CTR });
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
      map.set(n.id, { x: CTR + Math.cos(angle) * RAD, y: CTR + Math.sin(angle) * RAD });
    });
    return map;
  }, [result]);

  const displayNodes = result?.nodes ?? BASE_NODES;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <motion.header {...fadeUp} className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Trust Simulation</h1>
        <p className="text-xs text-zinc-500">Simulate trust events and visualize consequences</p>
      </motion.header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Controls */}
        <motion.aside {...fadeUp} className="w-72 border-r border-zinc-800 p-4 space-y-3 flex-shrink-0">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Simulate Event</p>
          {ACTIONS.map((a) => (
            <button key={a.id} onClick={() => handleAction(a.id)}
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${a.color}`}>
              <span>{a.icon}</span> {a.label}
            </button>
          ))}

          <AnimatePresence mode="wait">
            {result && (
              <motion.div key={result.action} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} className="glass rounded-xl p-4 mt-4">
                <p className="text-sm font-semibold text-zinc-200 mb-1">
                  {result.action === 'revoke' ? '⚡ Revocation' : result.action === 'add' ? '✓ Addition' : '◎ Subscription'}
                </p>
                <p className="text-[11px] text-zinc-500">{result.description}</p>
                <p className="text-[10px] text-zinc-600 mt-2">{result.affectedCount} node(s) impacted</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* Graph */}
        <div className="flex-1 flex items-center justify-center">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-lg">
            {/* Edges */}
            {EDGES.map((e, i) => {
              const s = positions.get(e.from);
              const t = positions.get(e.to);
              if (!s || !t) return null;
              const srcNode = displayNodes.find((n) => n.id === e.from);
              const tgtNode = displayNodes.find((n) => n.id === e.to);
              const affected = srcNode?.affected && tgtNode?.affected;
              return (
                <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={affected ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={affected ? 1.5 : 0.8} />
              );
            })}

            {/* Nodes */}
            {displayNodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              const color = node.affected ? '#EF4444' : (GROUP_COLORS[node.group] ?? '#888');
              const r = node.group === 'clinician' ? 14 : 10;

              return (
                <g key={node.id}>
                  {(node.affected || node.added) && (
                    <motion.circle cx={pos.x} cy={pos.y} r={r * 2.5}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.1, 0.25, 0.1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      fill={node.affected ? '#EF4444' : '#34D399'} />
                  )}
                  <motion.circle cx={pos.x} cy={pos.y} r={r}
                    fill={node.added ? '#34D399' + '99' : color + '99'}
                    stroke={node.added ? '#34D399' : color}
                    strokeWidth={1.5}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }} />
                  <text x={pos.x} y={pos.y + r + 12} textAnchor="middle"
                    fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="system-ui">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </main>
  );
}
