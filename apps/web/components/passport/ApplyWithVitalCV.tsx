'use client';

/**
 * ApplyWithVitalCV.tsx — Wave 88: Apply Button
 *
 * Generates a credential bundle link for employer ATS integration.
 */

import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';

interface ApplyWithVitalCVProps {
  npi: string;
  shareUrl?: string;
  className?: string;
}

export function ApplyWithVitalCV({ npi, shareUrl, className = '' }: ApplyWithVitalCVProps) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${npi}`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  return (
    <div className={`space-y-3 ${className}`}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 bg-vt-success hover:bg-vt-success/90 rounded-xl text-sm font-semibold text-foreground transition-colors"
        onClick={handleCopy}
      >
        {copied ? 'Link Copied!' : 'Apply with VitalCV'}
      </motion.button>
      <div className="flex gap-2">
        <button onClick={handleCopy} className="flex-1 py-2 bg-vt-neutral-800 hover:bg-vt-neutral-700 rounded-lg text-[11px] text-vt-neutral-400 transition-colors">
          {copied ? 'Copied' : 'Copy Link'}
        </button>
        <a href={`mailto:?subject=VitalCV%20Trust%20Profile&body=${encodeURIComponent(url)}`}
          className="flex-1 py-2 bg-vt-neutral-800 hover:bg-vt-neutral-700 rounded-lg text-[11px] text-vt-neutral-400 text-center transition-colors">
          Email
        </a>
      </div>
      <p className="text-[9px] text-vt-neutral-600 text-center">
        Share your verified credential profile with employers
      </p>
    </div>
  );
}

export default ApplyWithVitalCV;
