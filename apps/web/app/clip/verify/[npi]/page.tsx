'use client';

/**
 * App Clip Verification Page — Wave 52
 *
 * This page is the target for Apple App Clip and Android Instant App
 * deep links. When a verifier scans a clinician's QR code (from their
 * wallet pass or badge), this page loads instantly and performs a
 * real-time OIDC4VP verification without requiring an app download.
 *
 * Route: /clip/verify/[npi]
 * AASA: Already configured to route /clip/verify/* to App Clip
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

type VerificationStatus = 'LOADING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';

interface ClipVerificationResult {
  clinicianName: string;
  npi: string;
  crsScore: number;
  crsBand: 'GREEN' | 'YELLOW' | 'RED';
  credentials: string[];
  verifiedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  GREEN: { bg: 'bg-emerald-500', text: 'text-emerald-500', icon: '✓' },
  YELLOW: { bg: 'bg-amber-500', text: 'text-amber-500', icon: '⚠' },
  RED: { bg: 'bg-red-500', text: 'text-red-500', icon: '✗' },
};

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function ClipVerifyPage() {
  const params = useParams();
  const npi = typeof params.npi === 'string' ? params.npi : '';

  const [status, setStatus] = useState<VerificationStatus>('LOADING');
  const [result, setResult] = useState<ClipVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    if (!npi || !/^\d{10}$/.test(npi)) {
      setError('Invalid NPI format');
      setStatus('FAILED');
      return;
    }

    try {
      // TODO: Replace with real API call to /api/oidc/authorize + /api/matcha/readiness
      // Stub: simulate verification delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Stub result — in production, this comes from the OIDC4VP flow
      const stubResult: ClipVerificationResult = {
        clinicianName: 'Verification Pending',
        npi,
        crsScore: 0,
        crsBand: 'YELLOW',
        credentials: [],
        verifiedAt: new Date().toISOString(),
      };

      // Try to fetch real readiness data
      const response = await fetch(`/api/matcha/readiness/${npi}`);
      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        if (typeof data.overallScore === 'number') {
          stubResult.crsScore = data.overallScore as number;
        }
        if (typeof data.overallBand === 'string') {
          stubResult.crsBand = data.overallBand as ClipVerificationResult['crsBand'];
        }
      }

      setResult(stubResult);
      setStatus(stubResult.crsScore > 0 ? 'VERIFIED' : 'FAILED');
    } catch {
      setError('Verification request failed');
      setStatus('FAILED');
    }
  }, [npi]);

  useEffect(() => {
    verify();
  }, [verify]);

  const bandStyle = result
    ? BAND_STYLES[result.crsBand] ?? BAND_STYLES.RED
    : BAND_STYLES.YELLOW;

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {status === 'LOADING' && (
          <motion.div
            key="loading"
            {...fadeIn}
            className="glass text-center p-8 rounded-2xl max-w-sm w-full"
          >
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Verifying credentials...</p>
            <p className="text-sm text-zinc-400 mt-1">NPI: {npi}</p>
          </motion.div>
        )}

        {status === 'VERIFIED' && result && (
          <motion.div
            key="verified"
            {...fadeIn}
            className="glass p-8 rounded-2xl max-w-sm w-full"
          >
            {/* Band indicator */}
            <div className={`w-16 h-16 ${bandStyle.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <span className="text-3xl text-white">{bandStyle.icon}</span>
            </div>

            <h1 className="text-2xl font-bold text-center mb-1">
              {result.crsBand === 'GREEN' ? 'Verified' : 'Partially Verified'}
            </h1>

            <p className="text-center text-zinc-400 text-sm mb-6">
              {new Date(result.verifiedAt).toLocaleString()}
            </p>

            {/* CRS Score */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Readiness Score</span>
                <span className={`text-2xl font-bold ${bandStyle.text}`}>
                  {result.crsScore}%
                </span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${bandStyle.bg} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${result.crsScore}%` }}
                  transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            </div>

            {/* NPI */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">NPI</span>
                <span className="font-mono text-sm">{result.npi}</span>
              </div>
            </div>

            {/* Powered by */}
            <p className="text-center text-zinc-500 text-xs mt-6">
              Verified by VitalCV · Cryptographic Trust Infrastructure
            </p>
          </motion.div>
        )}

        {status === 'FAILED' && (
          <motion.div
            key="failed"
            {...fadeIn}
            className="glass text-center p-8 rounded-2xl max-w-sm w-full"
          >
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✗</span>
            </div>
            <h1 className="text-xl font-bold mb-2">Verification Failed</h1>
            <p className="text-sm text-zinc-400">
              {error ?? 'Unable to verify this clinician at this time.'}
            </p>
            <button
              onClick={verify}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
