'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2, Shield, XCircle, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { BackgroundField } from '@/components/ui/BackgroundField';
import {
  TrustGraphPrimary,
  DEMO_NODES,
  DEMO_EDGES,
  type GraphNode,
  type GraphEdge,
} from '@/components/graph/TrustGraphPrimary';
import { KnowledgePanel } from '@/components/graph/KnowledgePanel';

/* ── Types ────────────────────────────────────────────────── */

type DemoStep = 'input' | 'processing' | 'graph' | 'decision' | 'revocation';

interface ProcessingPhase {
  label: string;
  duration: number;
}

const PROCESSING_PHASES: ProcessingPhase[] = [
  { label: 'Resolving NPI identity…', duration: 800 },
  { label: 'Querying primary sources…', duration: 1200 },
  { label: 'Verifying medical license…', duration: 1000 },
  { label: 'Checking NPDB/OIG exclusions…', duration: 900 },
  { label: 'Building trust graph…', duration: 700 },
  { label: 'Running readiness evaluator…', duration: 600 },
];

/* ── Processing animation ─────────────────────────────────── */

function ProcessingView({ onComplete }: { onComplete: () => void }) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);

  useState(() => {
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    PROCESSING_PHASES.forEach((phase, i) => {
      elapsed += phase.duration;
      timers.push(
        setTimeout(() => {
          setCompleted((prev) => [...prev, i]);
          setCurrentPhase(i + 1);
          if (i === PROCESSING_PHASES.length - 1) {
            setTimeout(onComplete, 500);
          }
        }, elapsed),
      );
    });

    return () => timers.forEach(clearTimeout);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto space-y-3"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center rounded-full bg-infra-blue-muted p-3 mb-3">
          <Loader2 className="h-6 w-6 text-infra-blue animate-spin" />
        </div>
        <h2 className="text-lg font-bold font-heading">Trust Engine Processing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Running primary source verification pipeline
        </p>
      </div>

      <div className="space-y-2">
        {PROCESSING_PHASES.map((phase, i) => {
          const isCompleted = completed.includes(i);
          const isActive = currentPhase === i && !isCompleted;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors ${
                isCompleted
                  ? 'border-infra-green/30 bg-infra-green-muted'
                  : isActive
                    ? 'border-infra-blue/30 bg-infra-blue-muted'
                    : 'border-infra-border bg-white/50'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-infra-green shrink-0" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 text-infra-blue animate-spin shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-infra-border shrink-0" />
              )}
              <span
                className={`text-sm ${
                  isCompleted
                    ? 'text-infra-green font-medium'
                    : isActive
                      ? 'text-infra-blue font-medium'
                      : 'text-muted-foreground'
                }`}
              >
                {phase.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Decision capsule ─────────────────────────────────────── */

function DecisionCapsule({
  onRevoke,
}: {
  onRevoke: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="max-w-sm mx-auto rounded-2xl border-2 border-infra-green/30 bg-white shadow-lg overflow-hidden"
    >
      <div className="bg-infra-green-muted px-6 py-4 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-infra-green" />
          <span className="text-sm font-bold uppercase tracking-wider text-infra-green">
            Trust Decision
          </span>
        </div>
        <h3 className="text-2xl font-bold font-heading text-foreground">CLEARED</h3>
        <p className="text-xs text-muted-foreground mt-1">
          All primary source verifications passed
        </p>
      </div>

      <div className="px-6 py-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-bold font-mono">97.2%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Trust Band</span>
          <span className="font-bold text-infra-green">GREEN</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Verification Sources</span>
          <span className="font-bold font-mono">4/4</span>
        </div>

        <div className="pt-2">
          <button
            onClick={onRevoke}
            className="w-full rounded-xl border border-infra-red/30 bg-infra-red-muted px-4 py-2.5 text-sm font-semibold text-infra-red transition hover:bg-infra-red/10"
          >
            Simulate Revocation
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Revocation view ──────────────────────────────────────── */

function RevocationView({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-sm mx-auto text-center space-y-4"
    >
      <div className="inline-flex items-center justify-center rounded-full bg-infra-red-muted p-4">
        <XCircle className="h-8 w-8 text-infra-red" />
      </div>
      <h3 className="text-xl font-bold font-heading text-foreground">
        Credential Revoked
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
        Medical license CA-2847391 has been revoked by CA Medical Board.
        Trust band changed from GREEN to RED.
      </p>
      <div className="rounded-xl border border-infra-red/30 bg-infra-red-muted px-4 py-3 font-mono text-xs text-infra-red">
        REVOCATION SIGNAL PROPAGATED → 2 employers notified
      </div>
      <button
        onClick={onReset}
        className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-6 py-2.5 text-sm font-semibold transition hover:opacity-90"
      >
        Run Again
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

/* ── Demo page ────────────────────────────────────────────── */

export default function DemoPage() {
  const [step, setStep] = useState<DemoStep>('input');
  const [npi, setNpi] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const handleSubmit = useCallback(() => {
    if (npi.trim().length < 3) return;
    setStep('processing');
  }, [npi]);

  const handleProcessingComplete = useCallback(() => {
    setStep('graph');
  }, []);

  const handleShowDecision = useCallback(() => {
    setStep('decision');
  }, []);

  const handleRevoke = useCallback(() => {
    setStep('revocation');
  }, []);

  const handleReset = useCallback(() => {
    setNpi('');
    setStep('input');
    setSelectedNode(null);
  }, []);

  return (
    <BackgroundField className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-infra-border bg-infra-blue-muted px-4 py-1.5 mb-4">
            <Zap className="h-3.5 w-3.5 text-infra-blue" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-infra-blue">
              Interactive Demo
            </span>
          </div>
          <h1 className="text-3xl font-bold font-heading text-foreground">
            Trust Engine Demo
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Enter any NPI to see how VitalCV builds a cryptographic trust graph
            from primary source data.
          </p>
        </motion.div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="rounded-2xl border border-infra-border bg-white/90 backdrop-blur-sm p-6 shadow-sm">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  NPI Number
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={npi}
                    onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 1003000126"
                    className="flex-1 rounded-xl border border-infra-border bg-infra-surface px-4 py-2.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-infra-blue focus:border-infra-blue"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={npi.trim().length < 3}
                    className="rounded-xl bg-infra-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Verify
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Try: 1003000126 (demo data)
                </p>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProcessingView onComplete={handleProcessingComplete} />
            </motion.div>
          )}

          {step === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <TrustGraphPrimary
                nodes={DEMO_NODES}
                edges={DEMO_EDGES}
                onNodeClick={setSelectedNode}
              />
              <div className="text-center">
                <button
                  onClick={handleShowDecision}
                  className="inline-flex items-center gap-2 rounded-xl bg-infra-green px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Show Decision Capsule
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'decision' && (
            <motion.div
              key="decision"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DecisionCapsule onRevoke={handleRevoke} />
            </motion.div>
          )}

          {step === 'revocation' && (
            <motion.div
              key="revocation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RevocationView onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Knowledge Panel */}
      <KnowledgePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </BackgroundField>
  );
}
