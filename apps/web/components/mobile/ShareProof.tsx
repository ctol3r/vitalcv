'use client';

/**
 * ShareProof.tsx — Wave 56: Share Credential Proof
 *
 * Modal overlay allowing clinicians to share their verified credential
 * status via QR code, deep link, or native share.
 */

import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface ShareProofProps {
  npi: string;
  crsScore: number;
  crsBand: string;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://app.vitalcv.com';

const BAND_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-400',
  YELLOW: 'text-amber-400',
  RED: 'text-red-400',
};

// ── QR Code Placeholder ───────────────────────────────────────────────────

function QrPlaceholder({ value }: { value: string }) {
  // Deterministic pattern from value hash
  const cells = useMemo(() => {
    const grid: boolean[][] = [];
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    for (let row = 0; row < 11; row++) {
      grid[row] = [];
      for (let col = 0; col < 11; col++) {
        hash = ((hash << 5) - hash + row * 11 + col) | 0;
        // Fixed corners for finder patterns
        const isCorner =
          (row < 3 && col < 3) ||
          (row < 3 && col > 7) ||
          (row > 7 && col < 3);
        grid[row][col] = isCorner || Math.abs(hash % 3) !== 0;
      }
    }
    return grid;
  }, [value]);

  return (
    <svg viewBox="0 0 13 13" className="w-44 h-44 mx-auto">
      <rect width="13" height="13" fill="white" rx="0.5" />
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect key={`${r}-${c}`} x={c + 1} y={r + 1} width="1" height="1" fill="#1a1a1a" rx="0.1" />
          ) : null,
        ),
      )}
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function ShareProof({ npi, crsScore, crsBand, onClose }: ShareProofProps) {
  const verifyUrl = `${BASE_URL}/verify/${npi}`;
  const deepLink = `vitalcv://verify/${npi}`;

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'VitalCV Credential Proof',
          text: `Verify my credentials — CRS: ${crsScore}% (${crsBand})`,
          url: verifyUrl,
        });
      } catch {
        // User cancelled or share failed silently
      }
    }
  }, [crsScore, crsBand, verifyUrl]);

  const handleCopyLink = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(verifyUrl);
    }
  }, [verifyUrl]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Share Proof</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm">✕</button>
        </div>

        {/* CRS Badge */}
        <div className="text-center mb-5">
          <span className={`text-3xl font-bold ${BAND_COLORS[crsBand] ?? 'text-zinc-400'}`}>
            {crsScore}%
          </span>
          <p className="text-xs text-zinc-500 mt-1">Credential Readiness Score</p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-xl p-3 mb-5">
          <QrPlaceholder value={verifyUrl} />
        </div>

        {/* Deep Link */}
        <div className="bg-white/[0.03] rounded-lg px-3 py-2 mb-4">
          <p className="text-[10px] text-zinc-500 mb-1">Verification Link</p>
          <p className="text-xs text-zinc-300 font-mono truncate">{verifyUrl}</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl text-sm font-medium transition-colors"
          >
            Copy Link
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors"
            >
              Share via...
            </button>
          )}

          <a
            href={deepLink}
            className="block w-full py-2.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl text-sm text-center text-zinc-400 transition-colors"
          >
            Open in Wallet App
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ShareProof;
