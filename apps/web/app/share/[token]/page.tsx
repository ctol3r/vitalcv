'use client';

/**
 * Share Page — Wave 61: Trust Network Growth
 *
 * Route: /share/:token
 * Displays clinician trust state, CRS score, and verification badge.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────

interface ShareData {
  npi: string;
  expiresAt: string;
}

interface TrustState {
  npi: string;
  crs: { overallBand: string; overallScore: number };
  credentials: Array<{ id: string; source: string; status: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  GREEN: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Verified' },
  YELLOW: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Pending' },
  RED: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'At Risk' },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [trustState, setTrustState] = useState<TrustState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Resolve token
      const tokenRes = await fetch(`/api/share/trust/${token}`);
      if (!tokenRes.ok) throw new Error('Link expired or invalid');
      const tokenData = (await tokenRes.json()) as ShareData;
      setShareData(tokenData);

      // Load trust state
      const trustRes = await fetch(`/api/graph/explorer/${tokenData.npi}`);
      if (trustRes.ok) {
        const td = (await trustRes.json()) as TrustState;
        setTrustState(td);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) loadData(); }, [token, loadData]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading trust proof...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-20">🔒</div>
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  const band = trustState?.crs.overallBand ?? 'GREEN';
  const cfg = BAND_CONFIG[band] ?? BAND_CONFIG.GREEN;
  const score = trustState?.crs.overallScore ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <motion.div {...fadeUp} className="glass rounded-2xl p-8 max-w-sm w-full text-center">
        {/* Badge */}
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className={`w-24 h-24 rounded-full border-2 ${cfg.bg} flex items-center justify-center mx-auto mb-6`}
        >
          <div>
            <p className={`text-2xl font-bold ${cfg.color}`}>{score}</p>
            <p className="text-[8px] text-zinc-500">CRS</p>
          </div>
        </motion.div>

        {/* Status */}
        <h2 className="text-lg font-semibold mb-1">Credential Verified</h2>
        <p className="text-xs text-zinc-500 mb-4">NPI: {shareData?.npi}</p>

        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${cfg.bg}`}>
          <div className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
          <span className={cfg.color}>{cfg.label}</span>
        </div>

        {/* Credentials */}
        {trustState && trustState.credentials.length > 0 && (
          <div className="mt-6 space-y-1.5 text-left">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Verified Credentials</p>
            {trustState.credentials.slice(0, 5).map((cred) => (
              <div key={cred.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-zinc-300">{cred.source}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expiry */}
        {shareData?.expiresAt && (
          <p className="text-[9px] text-zinc-600 mt-6">
            Link expires {new Date(shareData.expiresAt).toLocaleDateString()}
          </p>
        )}

        {/* CTA */}
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <p className="text-[10px] text-zinc-500 mb-2">Powered by VitalCV</p>
          <Link href="/" className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors">
            Learn more →
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
