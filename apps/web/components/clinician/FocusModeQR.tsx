'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface FocusModeQRProps {
  open: boolean;
  onClose: () => void;
  npi: string;
  name: string;
}

export function FocusModeQR({ open, onClose, npi, name }: FocusModeQRProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Focus Mode QR"
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl border border-border bg-white/95 p-8 text-center shadow-2xl backdrop-blur-md dark:bg-muted"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-[var(--warm-charcoal)]/50 hover:text-[var(--warm-charcoal)] transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Mock QR */}
            <div className="mx-auto h-48 w-48 rounded-2xl border-2 border-dashed border-[var(--warm-charcoal)]/20 bg-[var(--warm-charcoal)]/[0.04] flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-32 w-32 text-[var(--warm-charcoal)]/30">
                <rect x="10" y="10" width="25" height="25" rx="3" fill="currentColor" />
                <rect x="65" y="10" width="25" height="25" rx="3" fill="currentColor" />
                <rect x="10" y="65" width="25" height="25" rx="3" fill="currentColor" />
                <rect x="40" y="40" width="20" height="20" rx="2" fill="currentColor" opacity="0.5" />
                <rect x="70" y="70" width="15" height="15" rx="2" fill="currentColor" opacity="0.4" />
                <rect x="45" y="15" width="10" height="10" rx="1" fill="currentColor" opacity="0.3" />
                <rect x="15" y="45" width="10" height="10" rx="1" fill="currentColor" opacity="0.3" />
              </svg>
            </div>

            <p className="mt-6 font-fraunces text-xl font-semibold text-[var(--warm-charcoal)]">
              {name}
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--warm-charcoal)]/60">
              NPI {npi}
            </p>
            <p className="mt-4 text-xs text-[var(--warm-charcoal)]/50">
              Scan to verify credentials instantly
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
