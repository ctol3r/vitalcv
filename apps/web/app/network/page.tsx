'use client';

/**
 * Trust Network Page — Wave 55
 *
 * Full-screen trust graph explorer with operational panels.
 * Routes to /network — user enters an NPI to explore the trust network.
 *
 * Layout:
 *   Left panel  — clinician identity, CRS ring, L0–L3 badge rail
 *   Center      — interactive trust network graph
 *   Right panel — verification timeline, audit artifact hashes, system status
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TrustGraph from '@/components/graph/TrustGraph';
import type { GraphNode } from '@/components/graph/TrustGraph';
import { SystemStatusPanel } from '@/components/SystemStatusPanel';
import { NetworkActivity } from '@/components/NetworkActivity';

// ── Types ─────────────────────────────────────────────────────────────────

interface ExplorerData {
  npi: string;
  graph: {
    nodes: GraphNode[];
    edges: Array<{ source: string; target: string; label: string; weight?: number }>;
  };
  crs: {
    overallBand: string;
    overallScore: number;
    evaluations: Array<{
      policyId: string;
      facilityName: string;
      roleName: string;
      crsScore: number;
      crsBand: string;
      isCleared: boolean;
    }>;
  };
  audit: {
    events: Array<{
      id: string;
      type: string;
      hash: string;
      createdAt: string;
    }>;
    totalCount: number;
  };
  credentials: Array<{
    id: string;
    source: string;
    status: string;
    lifecycleState: string;
    verifiedAt: string;
    expiresAt: string | null;
  }>;
}

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-400',
  YELLOW: 'text-amber-400',
  RED: 'text-red-400',
};

const BAND_RING: Record<string, string> = {
  GREEN: 'stroke-emerald-400',
  YELLOW: 'stroke-amber-400',
  RED: 'stroke-red-400',
};

const CLAIM_LEVELS = [
  { level: 'L0', label: 'Unverified', color: 'bg-zinc-600' },
  { level: 'L1', label: 'Self-Attested', color: 'bg-blue-500' },
  { level: 'L2', label: 'Verified', color: 'bg-amber-500' },
  { level: 'L3', label: 'PSV Complete', color: 'bg-emerald-500' },
];

const STATUS_DOTS: Record<string, string> = {
  active: 'bg-emerald-400',
  Valid: 'bg-emerald-400',
  expired: 'bg-zinc-500',
  EXPIRED: 'bg-zinc-500',
  REVOKED: 'bg-red-400',
};

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── CRS Ring SVG ──────────────────────────────────────────────────────────

function CrsRingSvg({ score, band }: { score: number; band: string }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const ringColor = BAND_RING[band] ?? 'stroke-zinc-500';

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"
        />
        <motion.circle
          cx="50" cy="50" r={radius}
          fill="none"
          className={ringColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${BAND_COLORS[band] ?? 'text-zinc-400'}`}>
          {score}
        </span>
        <span className="text-[10px] text-zinc-500">CRS</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [npiInput, setNpiInput] = useState('');
  const [activeNpi, setActiveNpi] = useState<string | null>(null);
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async (npi: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/graph/explorer/${npi}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as ExplorerData;
      setData(result);
      setActiveNpi(npi);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = npiInput.trim();
      if (/^\d{10}$/.test(trimmed)) {
        loadGraph(trimmed);
      }
    },
    [npiInput, loadGraph],
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <motion.header
        {...fadeIn}
        className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-semibold">Trust Network</h1>
          <p className="text-xs text-zinc-500">Explore credential authority graphs</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={npiInput}
            onChange={(e) => setNpiInput(e.target.value)}
            placeholder="Enter NPI (10 digits)"
            className="bg-white/[0.05] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-48"
            maxLength={10}
          />
          <button
            type="submit"
            disabled={!/^\d{10}$/.test(npiInput.trim()) || loading}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Loading...' : 'Explore'}
          </button>
        </form>
      </motion.header>

      {/* Empty state */}
      {!activeNpi && !loading && (
        <div className="flex-1 flex items-center justify-center h-[calc(100vh-73px)]">
          <motion.div {...fadeIn} className="text-center max-w-md">
            <div className="text-5xl mb-4 opacity-20">◎</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">
              Trust Network Explorer
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Enter a clinician NPI to visualize their credential authority graph,
              readiness score, and verification timeline.
            </p>
            <SystemStatusPanel compact className="justify-center" />
          </motion.div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <div className="text-center">
            <p className="text-red-400">Failed to load: {error}</p>
          </div>
        </div>
      )}

      {/* Graph Explorer */}
      {data && activeNpi && !error && (
        <div className="flex h-[calc(100vh-73px)]">
          {/* ── Left Panel ──────────────────────────────────────── */}
          <motion.aside
            {...fadeIn}
            transition={{ ...fadeIn.transition, delay: 0.1 }}
            className="w-72 border-r border-zinc-800 overflow-y-auto p-4 space-y-5 flex-shrink-0"
          >
            {/* Clinician Identity */}
            <section className="text-center">
              <div className="w-12 h-12 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">◎</span>
              </div>
              <p className="text-sm font-semibold">NPI: {data.npi}</p>
              <p className="text-xs text-zinc-500">
                {data.credentials.length} credential{data.credentials.length !== 1 ? 's' : ''}
              </p>
            </section>

            {/* CRS Ring */}
            <section>
              <CrsRingSvg score={data.crs.overallScore} band={data.crs.overallBand} />
            </section>

            {/* L0–L3 Badge Rail */}
            <section>
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                Claim Levels
              </h3>
              <div className="flex gap-1">
                {CLAIM_LEVELS.map((cl) => (
                  <div
                    key={cl.level}
                    className="flex-1 text-center py-1.5 rounded-md bg-white/[0.03]"
                  >
                    <div className={`w-3 h-3 rounded-full ${cl.color} mx-auto mb-1`} />
                    <p className="text-[9px] font-bold text-zinc-400">{cl.level}</p>
                    <p className="text-[8px] text-zinc-600">{cl.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Credentials */}
            <section>
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                Credentials
              </h3>
              <div className="space-y-1">
                {data.credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02]"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[cred.status] ?? 'bg-zinc-500'}`} />
                    <span className="text-[11px] text-zinc-300 truncate">{cred.source}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* System Status */}
            <SystemStatusPanel compact />
          </motion.aside>

          {/* ── Center: Graph ──────────────────────────────────── */}
          <motion.div
            {...fadeIn}
            transition={{ ...fadeIn.transition, delay: 0.2 }}
            className="flex-1 relative"
          >
            <TrustGraph
              nodes={data.graph.nodes}
              edges={data.graph.edges}
              width={typeof window !== 'undefined' ? Math.max(window.innerWidth - 576, 400) : 800}
              height={typeof window !== 'undefined' ? window.innerHeight - 73 : 600}
              className="w-full h-full"
            />
          </motion.div>

          {/* ── Right Panel ─────────────────────────────────────── */}
          <motion.aside
            {...fadeIn}
            transition={{ ...fadeIn.transition, delay: 0.3 }}
            className="w-72 border-l border-zinc-800 overflow-y-auto p-4 space-y-5 flex-shrink-0"
          >
            {/* Verification Timeline */}
            <section>
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                Verification Timeline ({data.audit.totalCount})
              </h3>
              <div className="space-y-1">
                {data.audit.events.slice(0, 20).map((event) => (
                  <div
                    key={event.id}
                    className="px-2 py-1.5 rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <p className="text-[11px] text-zinc-300">
                      {event.type.replace(/_/g, ' ')}
                    </p>
                    <div className="flex justify-between mt-0.5">
                      <time className="text-[9px] text-zinc-600">
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                      <span className="text-[9px] font-mono text-zinc-700">
                        {event.hash.slice(0, 12)}…
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Network Activity */}
            <NetworkActivity maxEvents={6} />
          </motion.aside>
        </div>
      )}
    </main>
  );
}
