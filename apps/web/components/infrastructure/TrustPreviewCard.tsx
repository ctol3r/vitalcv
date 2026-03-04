'use client';

/**
 * TrustPreviewCard.tsx — Wave 63: NPI Trust Preview
 *
 * User enters NPI → card animates in with CRS ring, L-level badges,
 * and verification timestamp. Shows blurred placeholder before lookup.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface TrustData {
  npi: string;
  crs: { overallBand: string; overallScore: number };
  credentials: Array<{ id: string; source: string; status: string; lifecycleState: string; verifiedAt: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_CFG: Record<string, { color: string; ring: string; label: string }> = {
  GREEN: { color: 'text-emerald-400', ring: 'stroke-emerald-400', label: 'Verified' },
  YELLOW: { color: 'text-amber-400', ring: 'stroke-amber-400', label: 'Pending Review' },
  RED: { color: 'text-red-400', ring: 'stroke-red-400', label: 'At Risk' },
};

const LEVELS: Record<string, { tag: string; color: string }> = {
  PSV_COMPLETE: { tag: 'L3', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  VERIFIED: { tag: 'L2', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  SELF_ATTESTED: { tag: 'L1', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  UNVERIFIED: { tag: 'L0', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
};

// ── CRS Mini Ring ─────────────────────────────────────────────────────────

function MiniCrsRing({ score, band }: { score: number; band: string }) {
  const r = 32; const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const cfg = BAND_CFG[band] ?? BAND_CFG.GREEN;

  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <motion.circle cx="38" cy="38" r={r} fill="none" className={cfg.ring}
          strokeWidth="5" strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold ${cfg.color}`}>{score}</span>
        <span className="text-[7px] text-zinc-500">CRS</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function TrustPreviewCard({ className = '' }: { className?: string }) {
  const [npi, setNpi] = useState('');
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async () => {
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) return;
    setLoading(true); setData(null);
    try {
      const res = await fetch(`/api/graph/explorer/${trimmed}`);
      if (!res.ok) throw new Error('Not found');
      setData((await res.json()) as TrustData);
    } catch { /* show placeholder */ }
    finally { setLoading(false); }
  }, [npi]);

  const handleSubmit = useCallback((e: React.FormEvent) => { e.preventDefault(); lookup(); }, [lookup]);

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-5 border-b border-white/[0.04]">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Instant Trust Lookup</p>
        <div className="flex gap-2">
          <input type="text" value={npi} onChange={(e) => setNpi(e.target.value)}
            placeholder="Enter NPI (10 digits)" maxLength={10}
            className="flex-1 bg-white/[0.04] border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
          <button type="submit" disabled={!/^\d{10}$/.test(npi.trim()) || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors">
            {loading ? '...' : 'Look Up'}
          </button>
        </div>
      </form>

      {/* Result / Placeholder */}
      <div className="p-5 min-h-[160px] relative">
        <AnimatePresence mode="wait">
          {data ? (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="flex items-start gap-4">
                <MiniCrsRing score={data.crs.overallScore} band={data.crs.overallBand} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200">NPI: {data.npi}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {data.credentials.length} credential{data.credentials.length !== 1 ? 's' : ''} verified
                  </p>

                  {/* L-level badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {data.credentials.slice(0, 4).map((cred) => {
                      const lvl = LEVELS[cred.lifecycleState] ?? LEVELS.UNVERIFIED;
                      return (
                        <span key={cred.id} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${lvl.color}`}>
                          {lvl.tag} <span className="font-normal opacity-70">{cred.source.slice(0, 15)}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Timestamp */}
                  {data.credentials[0]?.verifiedAt && (
                    <p className="text-[9px] text-zinc-600 mt-2">
                      Last verified: {new Date(data.credentials[0].verifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center h-[120px]">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] mx-auto mb-2 blur-[2px]" />
                <p className="text-[11px] text-zinc-600">Enter an NPI to preview trust state</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TrustPreviewCard;
