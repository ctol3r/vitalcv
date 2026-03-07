'use client';

/**
 * PassportShareActions.tsx — Wave 139: Clinician Passport Growth Loop
 *
 * Client-side share island embedded in the RSC public passport page (/p/:npi).
 * Provides: copy share link · QR code modal · download credential bundle.
 */

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import {
  CheckCircle,
  Copy,
  Download,
  Loader2,
  QrCode,
  Share2,
  X,
} from 'lucide-react';

interface PassportShareActionsProps {
  npi: string;
  credentialCount: number;
}

export default function PassportShareActions({ npi, credentialCount }: PassportShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://vitalcv.ai/p/${npi}`;

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(
      typeof window !== 'undefined' ? window.location.href : `https://vitalcv.ai/p/${npi}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [npi]);

  const downloadBundle = useCallback(async () => {
    setDownloading(true);
    try {
      const bundle = {
        version: '1.0',
        npi,
        generatedAt: new Date().toISOString(),
        shareUrl: typeof window !== 'undefined' ? window.location.href : `https://vitalcv.ai/p/${npi}`,
        credentialCount,
        attestedBy: 'VitalCV Trust Network',
        bundleType: 'PUBLIC_PASSPORT_BUNDLE',
        instructions: 'To verify credentials, visit the share URL above or contact VitalCV.',
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vitalcv-passport-npi-${npi}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [npi, credentialCount]);

  return (
    <>
      {/* Share strip */}
      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Share2 className="h-3.5 w-3.5 text-emerald-400" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Share Passport
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Copy link */}
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-3 px-2 text-[10px] text-gray-500 hover:text-gray-200 hover:border-emerald-500/30 transition-colors"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {/* QR code */}
          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-3 px-2 text-[10px] text-gray-500 hover:text-gray-200 hover:border-emerald-500/30 transition-colors"
          >
            <QrCode className="h-4 w-4" />
            QR code
          </button>

          {/* Download bundle */}
          <button
            type="button"
            onClick={downloadBundle}
            disabled={downloading}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-3 px-2 text-[10px] text-gray-500 hover:text-gray-200 hover:border-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? 'Bundling…' : 'Download'}
          </button>
        </div>
      </div>

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl border border-white/20 bg-slate-950 p-6 w-full max-w-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Scan to Verify</h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">NPI {npi}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQR(false)}
                  className="text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex justify-center bg-white p-4 rounded-xl">
                <QRCode value={shareUrl} size={192} level="M" />
              </div>

              <p className="text-[9px] text-gray-600 text-center break-all font-mono">
                {shareUrl}
              </p>

              <p className="text-[10px] text-gray-600 text-center">
                Scan to view verified credentials for NPI {npi}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
