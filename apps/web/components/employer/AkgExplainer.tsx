'use client';

/**
 * AkgExplainer — Wave 27: Authority-Bound Knowledge Graph
 *
 * Glassmorphic "AI Reasoning Trace" drawer for the employer portal.
 * When an employer views a clinician's readiness score, they can click
 * "Explain this Score" to see exactly how the AKG traversed bidirectional
 * links to reach its conclusion — with every cryptographic anchor cited.
 *
 * Uses framer-motion AnimatePresence for zero-jank drawer slide-in.
 * 'use client' required for fetch, useState, and motion hooks.
 * Zero hydration risk: drawer renders null on the server.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/api';
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  BadgeCheck,
  Brain,
  Building2,
  ChevronRight,
  CircleDot,
  FileCheck2,
  Fingerprint,
  Info,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';

// ── Shared types (mirrors akg-server.ts response schema) ──────────────────

type AKGNodeKind =
  | 'CLINICIAN'
  | 'LICENSE'
  | 'PSV_RECEIPT'
  | 'ARTIFACT'
  | 'STATE_BOARD'
  | 'EMPLOYER'
  | 'AUDIT_SNAPSHOT';

interface AKGNode {
  id: string;
  kind: AKGNodeKind;
  label: string;
  status: string;
  auditHash: string | null;
  verifiedAt: string | null;
}

interface AKGEdge {
  from: string;
  to: string;
  relationship: string;
  since: string | null;
}

interface AKGQueryResponse {
  schema: string;
  query: string;
  outcome: boolean;
  confidence: number;
  reasoning: string[];
  path: AKGNode[];
  edges: AKGEdge[];
  auditAnchor: string;
  generatedAt: string;
  caveats: string[];
}

// ── Props ─────────────────────────────────────────────────────────────────

interface AkgExplainerProps {
  /** 10-digit NPI of the clinician being viewed */
  npi: string;
  /** The employer's framing context, pre-filled into the query */
  context?: string;
  /** Backend URL; falls back to env var */
  backendUrl?: string;
}

// ── Node icon + colour map ────────────────────────────────────────────────

const NODE_META: Record<AKGNodeKind, { icon: React.ElementType; color: string; bg: string }> = {
  CLINICIAN:       { icon: User,        color: 'text-sky-400',     bg: 'bg-sky-500/10 ring-sky-500/30'     },
  LICENSE:         { icon: FileCheck2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 ring-emerald-500/30' },
  PSV_RECEIPT:     { icon: BadgeCheck,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 ring-emerald-500/30' },
  ARTIFACT:        { icon: Shield,      color: 'text-violet-400',  bg: 'bg-violet-500/10 ring-violet-500/30'  },
  STATE_BOARD:     { icon: Building2,   color: 'text-amber-400',   bg: 'bg-amber-500/10 ring-amber-500/30'   },
  EMPLOYER:        { icon: Building2,   color: 'text-sky-400',     bg: 'bg-sky-500/10 ring-sky-500/30'     },
  AUDIT_SNAPSHOT:  { icon: Anchor,      color: 'text-teal-400',    bg: 'bg-teal-500/10 ring-teal-500/30'    },
};

function getNodeMeta(kind: AKGNodeKind) {
  return NODE_META[kind] ?? NODE_META.ARTIFACT;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatReasoningLine(line: string): { icon: React.ElementType; color: string; text: string } {
  if (line.startsWith('[✓]'))  return { icon: ShieldCheck, color: 'text-emerald-400', text: line.slice(4) };
  if (line.startsWith('[✗]'))  return { icon: ShieldAlert,  color: 'text-red-400',     text: line.slice(4) };
  if (line.startsWith('[!]'))  return { icon: AlertTriangle, color: 'text-amber-400',  text: line.slice(4) };
  if (line.startsWith('[1]') || line.startsWith('[2]') || line.startsWith('[3]') || line.startsWith('[4]'))
    return { icon: CircleDot, color: 'text-slate-400', text: line.slice(4) };
  if (line.startsWith('[CONCLUSION]')) return { icon: Brain, color: 'text-violet-400', text: line.slice(13) };
  return { icon: Info, color: 'text-slate-500', text: line };
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.5) return 'Medium';
  if (c >= 0.2) return 'Low';
  return 'Insufficient';
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'text-emerald-400';
  if (c >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

// ── GraphPathStep ─────────────────────────────────────────────────────────

function GraphPathStep({
  node,
  edge,
  isLast,
}: {
  node: AKGNode;
  edge: AKGEdge | undefined;
  isLast: boolean;
}) {
  const meta = getNodeMeta(node.kind);
  const Icon = meta.icon;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-start gap-3 w-full">
        {/* Icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.bg}`}>
          <Icon className={`h-4 w-4 ${meta.color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white/80">{node.label}</span>
            <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ring-1 ${meta.bg} ${meta.color}`}>
              {node.kind}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                node.status === 'ACTIVE' || node.status === 'verified' || node.status === 'verified_monitoring'
                  ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                  : node.status === 'REVOKED' || node.status === 'INVALID' || node.status === 'expired'
                  ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30'
                  : 'bg-slate-800/60 text-slate-500'
              }`}
            >
              {node.status}
            </span>
          </div>

          {/* Audit hash */}
          {node.auditHash && (
            <div className="mt-1 flex items-center gap-1.5">
              <Fingerprint className="h-3 w-3 shrink-0 text-teal-500/60" />
              <span className="font-mono text-[10px] text-slate-600">
                anchor: {node.auditHash.slice(0, 20)}…
              </span>
            </div>
          )}

          {/* Verified timestamp */}
          {node.verifiedAt && (
            <p className="mt-0.5 font-mono text-[10px] text-slate-700">
              {new Date(node.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Edge arrow */}
      {!isLast && edge && (
        <div className="ml-4 my-1.5 flex items-center gap-1.5 self-start pl-10">
          <ChevronRight className="h-3 w-3 text-slate-700" />
          <span className="font-mono text-[10px] text-slate-600">{edge.relationship}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function AkgExplainer({ npi, context, backendUrl }: AkgExplainerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AKGQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = backendUrl ?? getApiBase();

  const runExplanation = useCallback(async () => {
    if (result) { setOpen(true); return; } // use cached result

    setLoading(true);
    setError(null);
    setOpen(true);

    const query = context
      ? `${context} NPI ${npi}`
      : `Is NPI ${npi} ready to start?`;

    try {
      const res = await fetch(
        `${base}/api/akg/query?q=${encodeURIComponent(query)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`AKG API returned ${res.status}`);
      const data = (await res.json()) as AKGQueryResponse;
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load AKG explanation');
    } finally {
      setLoading(false);
    }
  }, [npi, base, context, result]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={runExplanation}
        className="inline-flex items-center gap-2 rounded-xl bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-400 ring-1 ring-violet-500/30 transition hover:bg-violet-500/20 hover:ring-violet-500/50"
        aria-label="Explain this score using the AKG"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Explain this Score
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

      {/* Drawer backdrop + panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="akg-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.aside
              key="akg-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 38 }}
              className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-lg flex-col border-l border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/60"
              role="dialog"
              aria-label="AI Reasoning Trace"
            >
              {/* Drawer header */}
              <div className="flex items-center gap-3 border-b border-white/8 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/30">
                  <Brain className="h-4 w-4 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-white">AI Reasoning Trace</h2>
                  <p className="text-xs text-slate-500">Authority-Bound Knowledge Graph</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto">
                {loading && (
                  <div className="flex flex-col items-center justify-center gap-4 py-20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Brain className="h-8 w-8 text-violet-400/60" />
                    </motion.div>
                    <p className="text-sm text-slate-500">Traversing knowledge graph…</p>
                  </div>
                )}

                {error && !loading && (
                  <div className="m-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <p className="text-sm font-semibold text-red-400">Traversal failed</p>
                    </div>
                    <p className="text-xs text-slate-500">{error}</p>
                  </div>
                )}

                {result && !loading && (
                  <div className="space-y-6 p-6">
                    {/* Outcome banner */}
                    <div className={`flex items-center gap-4 rounded-2xl p-5 ring-1 ${
                      result.outcome
                        ? 'bg-emerald-500/5 ring-emerald-500/20'
                        : 'bg-red-500/5 ring-red-500/20'
                    }`}>
                      {result.outcome
                        ? <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-400" />
                        : <ShieldAlert  className="h-7 w-7 shrink-0 text-red-400"     />
                      }
                      <div>
                        <p className={`text-sm font-bold ${result.outcome ? 'text-emerald-400' : 'text-red-400'}`}>
                          {result.outcome ? 'Trust Requirements Satisfied' : 'Trust Requirements Not Met'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Confidence:{' '}
                          <span className={`font-semibold ${confidenceColor(result.confidence)}`}>
                            {confidenceLabel(result.confidence)} ({(result.confidence * 100).toFixed(0)}%)
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Graph path */}
                    <section>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Graph Path Traversed
                      </p>
                      <div className="rounded-2xl border border-white/8 bg-slate-900/40 p-4 space-y-2">
                        {result.path.map((node, i) => {
                          const outEdge = result.edges.find((e) => e.from === node.id);
                          return (
                            <GraphPathStep
                              key={node.id}
                              node={node}
                              edge={outEdge}
                              isLast={i === result.path.length - 1}
                            />
                          );
                        })}
                        {result.path.length === 0 && (
                          <p className="text-xs text-slate-600">No graph nodes resolved for this NPI.</p>
                        )}
                      </div>
                    </section>

                    {/* Reasoning chain */}
                    <section>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Reasoning Chain
                      </p>
                      <ol className="space-y-2">
                        {result.reasoning.map((line, i) => {
                          const { icon: Icon, color, text } = formatReasoningLine(line);
                          return (
                            <li key={i} className="flex items-start gap-2.5">
                              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
                              <span className="text-xs leading-relaxed text-slate-400">{text}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </section>

                    {/* Terminal audit anchor */}
                    <section className="rounded-2xl border border-teal-500/15 bg-teal-500/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Anchor className="h-4 w-4 text-teal-400" />
                        <p className="text-xs font-semibold text-teal-400">Cryptographic Audit Anchor</p>
                      </div>
                      <p className="font-mono text-[11px] text-slate-500 break-all">
                        {result.auditAnchor}
                      </p>
                      <p className="mt-1.5 text-[10px] text-slate-600">
                        SHA-256 of all path hashes — anchors this response to the transparency ledger.
                      </p>
                    </section>

                    {/* Caveats */}
                    <section className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Caveats</p>
                      </div>
                      {result.caveats.map((c, i) => (
                        <p key={i} className="text-[10px] leading-relaxed text-slate-500">• {c}</p>
                      ))}
                    </section>

                    {/* Generated at */}
                    <p className="text-center font-mono text-[10px] text-slate-700">
                      Generated: {new Date(result.generatedAt).toISOString()}
                    </p>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
