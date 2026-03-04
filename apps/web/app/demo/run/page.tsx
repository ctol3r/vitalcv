'use client';

/**
 * Demo Run Page — Wave 60: YC Demo Mode
 *
 * Route: /demo/run
 *
 * Guided 60-second demo: NPI → Trust State → Knowledge Graph →
 * Decision Capsule → Revocation Simulation → Verifier Approve.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoController } from '@/components/demo/DemoController';
import { DemoGraphOverlay } from '@/components/demo/DemoGraphOverlay';

// ── Types ─────────────────────────────────────────────────────────────────

interface DemoStep {
  id: string;
  label: string;
  description: string;
  durationMs: number;
  data: Record<string, unknown>;
}

interface DemoNode { id: string; label: string; group: string }
interface DemoEdge { source: string; target: string; label: string }

// ── Demo Data (client-side, mirrors demoEngine) ───────────────────────────

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'load-trust-state', label: 'Load Trust State',
    description: 'Loading credential trust state for NPI 9999999999',
    durationMs: 3000,
    data: { crsScore: 87, crsBand: 'GREEN', credentialCount: 4 },
  },
  {
    id: 'build-knowledge-graph', label: 'Build Knowledge Graph',
    description: 'Constructing authority-bound knowledge graph',
    durationMs: 4000,
    data: { nodeCount: 9, edgeCount: 8 },
  },
  {
    id: 'verify-credentials', label: 'Primary Source Verification',
    description: 'Verifying 4 credentials against primary sources',
    durationMs: 5000,
    data: { verified: 4, confidence: 0.97 },
  },
  {
    id: 'generate-decision', label: 'Generate Decision Capsule',
    description: 'Computing hiring decision with CRS evaluation',
    durationMs: 3000,
    data: { type: 'HIRING', status: 'VALID' },
  },
  {
    id: 'simulate-revocation', label: 'Revocation Simulation',
    description: 'Simulating Medical License revocation cascade',
    durationMs: 5000,
    data: { affectedNodes: 7, cascadeDepth: 3 },
  },
  {
    id: 'verifier-approve', label: 'Instant Verification',
    description: 'Verifier approves credential bundle in real-time',
    durationMs: 3000,
    data: { approved: true },
  },
];

const DEMO_NODES: DemoNode[] = [
  { id: 'clinician', label: 'NPI: 9999999999', group: 'clinician' },
  { id: 'cred-license', label: 'Medical License', group: 'credential' },
  { id: 'cred-dea', label: 'DEA Registration', group: 'credential' },
  { id: 'cred-board', label: 'Board Certification', group: 'credential' },
  { id: 'cred-priv', label: 'Hospital Privileges', group: 'credential' },
  { id: 'issuer-board', label: 'State Board', group: 'issuer' },
  { id: 'issuer-dea', label: 'DEA', group: 'issuer' },
  { id: 'employer-memorial', label: 'Memorial Hospital', group: 'employer' },
  { id: 'decision-hiring', label: 'Hiring Decision', group: 'decision' },
];

const DEMO_EDGES: DemoEdge[] = [
  { source: 'clinician', target: 'cred-license', label: 'HOLDS' },
  { source: 'clinician', target: 'cred-dea', label: 'HOLDS' },
  { source: 'clinician', target: 'cred-board', label: 'HOLDS' },
  { source: 'clinician', target: 'cred-priv', label: 'HOLDS' },
  { source: 'cred-license', target: 'issuer-board', label: 'ISSUED_BY' },
  { source: 'cred-dea', target: 'issuer-dea', label: 'ISSUED_BY' },
  { source: 'cred-priv', target: 'employer-memorial', label: 'PRIVILEGED_AT' },
  { source: 'cred-license', target: 'decision-hiring', label: 'INFORMS' },
];

// Step → which nodes/edges activate
const STEP_ACTIVATIONS: Record<string, { nodes: string[]; edges: number[] }> = {
  'load-trust-state': { nodes: ['clinician'], edges: [] },
  'build-knowledge-graph': { nodes: DEMO_NODES.map((n) => n.id), edges: [0, 1, 2, 3, 4, 5, 6, 7] },
  'verify-credentials': { nodes: ['cred-license', 'cred-dea', 'cred-board', 'cred-priv', 'issuer-board', 'issuer-dea'], edges: [4, 5] },
  'generate-decision': { nodes: ['decision-hiring', 'cred-license'], edges: [7] },
  'simulate-revocation': { nodes: ['cred-license', 'clinician', 'issuer-board', 'decision-hiring'], edges: [0, 4, 7] },
  'verifier-approve': { nodes: DEMO_NODES.map((n) => n.id), edges: [0, 1, 2, 3, 4, 5, 6, 7] },
};

// ── Constants ─────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

const BAND_COLORS: Record<string, string> = { GREEN: 'text-emerald-400', YELLOW: 'text-amber-400', RED: 'text-red-400' };

// ── Page ──────────────────────────────────────────────────────────────────

export default function DemoRunPage() {
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [stepData, setStepData] = useState<Record<string, unknown>>({});

  const activeNodes = useMemo(() => {
    if (!activeStepId) return new Set<string>();
    return new Set(STEP_ACTIVATIONS[activeStepId]?.nodes ?? []);
  }, [activeStepId]);

  const activeEdges = useMemo(() => {
    if (!activeStepId) return new Set<number>();
    return new Set(STEP_ACTIVATIONS[activeStepId]?.edges ?? []);
  }, [activeStepId]);

  const revokedNode = activeStepId === 'simulate-revocation' ? 'cred-license' : null;

  const handleStepChange = useCallback((_index: number, step: DemoStep) => {
    setActiveStepId(step.id);
    setStepData(step.data);
    setCompleted(false);
  }, []);

  const handleComplete = useCallback(() => {
    setCompleted(true);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <motion.header {...fadeUp} className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
            <span className="text-sm">▶</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold">VitalCV Demo</h1>
            <p className="text-xs text-zinc-500">Trust infrastructure in 60 seconds</p>
          </div>
        </div>
      </motion.header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left — Controller + Stats */}
        <motion.aside {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="w-80 border-r border-zinc-800 p-4 overflow-y-auto flex-shrink-0 space-y-4">

          <DemoController
            steps={DEMO_STEPS}
            onStepChange={handleStepChange}
            onComplete={handleComplete}
          />

          {/* Live Stats */}
          <AnimatePresence mode="wait">
            {activeStepId && (
              <motion.div key={activeStepId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} className="glass rounded-xl p-4 space-y-2">
                {Object.entries(stepData).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-[10px] text-zinc-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={`text-[10px] font-mono ${
                      key === 'crsBand' ? (BAND_COLORS[String(value)] ?? 'text-zinc-400') : 'text-zinc-300'
                    }`}>
                      {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {completed && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <p className="text-emerald-400 font-semibold text-sm mb-1">Demo Complete</p>
              <p className="text-[11px] text-zinc-500">Full trust lifecycle demonstrated</p>
            </motion.div>
          )}
        </motion.aside>

        {/* Center — Graph */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="flex-1 flex items-center justify-center p-8">
          <DemoGraphOverlay
            nodes={DEMO_NODES}
            edges={DEMO_EDGES}
            activeNodeIds={activeNodes}
            activeEdgeIndices={activeEdges}
            revokedNodeId={revokedNode}
          />
        </motion.div>
      </div>
    </main>
  );
}
