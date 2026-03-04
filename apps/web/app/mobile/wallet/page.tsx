'use client';

/**
 * Mobile Wallet Route — Wave 56
 *
 * Mobile-optimized credential wallet view with CRS ring,
 * L0–L3 credential cards, mini trust graph, and share button.
 *
 * Route: /mobile/wallet
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileTrustGraph } from '@/components/mobile/MobileTrustGraph';
import { ShareProof } from '@/components/mobile/ShareProof';
import { MobileStatusBar } from '@/components/mobile/MobileStatusBar';
import { fetchMobileTrustState } from '@/lib/api';
import type { TrustStateResponse } from '@/components/trust-state/types';

// ── Types ─────────────────────────────────────────────────────────────────

interface Credential {
  id: string;
  source: string;
  status: string;
  lifecycleState: string;
  verifiedAt: string;
  expiresAt: string | null;
}

interface WalletData {
  npi: string;
  graph: {
    nodes: Array<{ id: string; label: string; group: string; status?: string; val: number }>;
    edges: Array<{ source: string; target: string; label: string }>;
  };
  crs: { overallBand: string; overallScore: number };
  credentials: Credential[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-400',
  YELLOW: 'text-amber-400',
  RED: 'text-red-400',
};

const BAND_RING_STROKE: Record<string, string> = {
  GREEN: 'stroke-emerald-400',
  YELLOW: 'stroke-amber-400',
  RED: 'stroke-red-400',
};

const CLAIM_LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PSV_COMPLETE: { label: 'L3', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  VERIFIED: { label: 'L2', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  UNVERIFIED: { label: 'L1', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  active: { label: 'L1', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-400',
  Valid: 'bg-emerald-400',
  expired: 'bg-zinc-500',
  EXPIRED: 'bg-zinc-500',
  REVOKED: 'bg-red-400',
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── CRS Ring ──────────────────────────────────────────────────────────────

function CrsRing({ score, band }: { score: number; band: string }) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none"
          className={BAND_RING_STROKE[band] ?? 'stroke-zinc-500'}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${BAND_COLORS[band] ?? 'text-zinc-400'}`}>{score}</span>
        <span className="text-[10px] text-zinc-500 mt-0.5">Readiness Score</span>
      </div>
    </div>
  );
}

// ── Credential Card ───────────────────────────────────────────────────────

function CredentialCard({ credential, index }: { credential: Credential; index: number }) {
  const claimCfg = CLAIM_LEVEL_CONFIG[credential.lifecycleState] ?? CLAIM_LEVEL_CONFIG.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
      className={`rounded-xl border p-4 ${claimCfg.bg}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-200 truncate">{credential.source}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Verified {new Date(credential.verifiedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[credential.status] ?? 'bg-zinc-500'}`} />
          <span className={`text-xs font-bold ${claimCfg.color}`}>{claimCfg.label}</span>
        </div>
      </div>
      {credential.expiresAt && (
        <p className="text-[10px] text-zinc-600 mt-2">
          Expires: {new Date(credential.expiresAt).toLocaleDateString()}
        </p>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

function toFallbackWallet(targetNpi: string, ts: TrustStateResponse): WalletData {
  const s = ts.crs.score <= 1 ? Math.round(ts.crs.score * 100) : ts.crs.score;
  return { npi: targetNpi, graph: { nodes: [], edges: [] }, crs: { overallBand: ts.crs.band, overallScore: s }, credentials: [] };
}

export default function MobileWalletPage() {
  const [npi, setNpi] = useState('');
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const loadWallet = useCallback(async (targetNpi: string) => {
    setLoading(true);
    try {
      // Primary: graph explorer (full data)
      try {
        const res = await fetch(`/api/graph/explorer/${encodeURIComponent(targetNpi)}`);
        if (res.ok) { setData((await res.json()) as WalletData); return; }
      } catch { /* graph unavailable */ }
      // Fallback: trust-state CRS only
      const ts = await fetchMobileTrustState(targetNpi);
      if (ts) { setData(toFallbackWallet(targetNpi, ts)); return; }
      // Final: score 0 / band Not Ready
      setData({ npi: targetNpi, graph: { nodes: [], edges: [] }, crs: { overallBand: 'RED', overallScore: 0 }, credentials: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{10}$/.test(npi.trim())) loadWallet(npi.trim());
  }, [npi, loadWallet]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20">
      <MobileStatusBar />

      {/* Header */}
      <motion.div {...fadeUp} className="px-4 pt-14 pb-4">
        <h1 className="text-xl font-bold">Credential Wallet</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Your verified trust network</p>
      </motion.div>

      {/* NPI Input */}
      {!data && (
        <motion.form {...fadeUp} onSubmit={handleSubmit} className="px-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={npi}
              onChange={(e) => setNpi(e.target.value)}
              placeholder="Enter NPI"
              maxLength={10}
              className="flex-1 bg-white/[0.05] border border-zinc-700 rounded-xl px-4 py-3 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={!/^\d{10}$/.test(npi.trim()) || loading}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
            >
              {loading ? '...' : 'Load'}
            </button>
          </div>
        </motion.form>
      )}

      {data && (
        <>
          {/* CRS Ring */}
          <motion.section {...fadeUp} className="px-4 mb-6">
            <CrsRing score={data.crs.overallScore} band={data.crs.overallBand} />
          </motion.section>

          {/* Mini Trust Graph */}
          <motion.section
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="px-4 mb-6"
          >
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Trust Network</h2>
            <div className="glass rounded-xl p-2">
              <MobileTrustGraph
                nodes={data.graph.nodes}
                edges={data.graph.edges}
              />
            </div>
          </motion.section>

          {/* Credential Cards */}
          <motion.section
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="px-4 mb-6"
          >
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
              Credentials ({data.credentials.length})
            </h2>
            <div className="space-y-2">
              {data.credentials.map((cred, i) => (
                <CredentialCard key={cred.id} credential={cred} index={i} />
              ))}
            </div>
          </motion.section>

          {/* Share Button */}
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.3 }}
            className="px-4"
          >
            <button
              onClick={() => setShowShare(true)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors"
            >
              Share Credential Proof
            </button>
          </motion.div>

          {/* Share Modal */}
          <AnimatePresence>
            {showShare && (
              <ShareProof
                npi={data.npi}
                crsScore={data.crs.overallScore}
                crsBand={data.crs.overallBand}
                onClose={() => setShowShare(false)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </main>
  );
}
