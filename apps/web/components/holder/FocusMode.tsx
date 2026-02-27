'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

import type { HolderCredential } from '@/types/holder';

/* ------------------------------------------------------------------ */
/*  FocusMode — fullscreen high-contrast credential overlay            */
/* ------------------------------------------------------------------ */

const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1];

interface FocusModeProps {
  credential: HolderCredential | null;
  onClose: () => void;
}

export function FocusMode({ credential, onClose }: FocusModeProps) {
  /* Escape key dismiss */
  useEffect(() => {
    if (!credential) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [credential, onClose]);

  /* Body scroll lock */
  useEffect(() => {
    if (!credential) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [credential]);

  return (
    <AnimatePresence>
      {credential && (
        <motion.div
          key="focus-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            key="focus-content"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={(_e, info) => {
              if (info.velocity.y > 300 || info.offset.y > 200) {
                onClose();
              }
            }}
            className="max-w-lg w-full mx-auto flex flex-col items-center pt-20 px-6 pb-12"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Holder name */}
            <h2 className="text-4xl font-heading font-bold text-white text-center">
              {credential.holderName ?? 'Credential Holder'}
            </h2>

            {/* Issuer */}
            <p className="text-2xl text-white/80 mt-2 text-center">
              {credential.issuer}
            </p>

            {/* Details */}
            <div className="mt-6 space-y-2 text-center">
              {credential.licenseNumber && (
                <p className="text-lg text-white/60">
                  <span className="text-white/40">License #:</span>{' '}
                  {credential.licenseNumber}
                </p>
              )}
              {credential.npi && (
                <p className="text-lg text-white/60">
                  <span className="text-white/40">NPI:</span>{' '}
                  {credential.npi}
                </p>
              )}
              <p className="text-lg text-white/60">
                <span className="text-white/40">Status:</span>{' '}
                <span className="capitalize">{credential.state}</span>
              </p>
            </div>

            {/* QR placeholder */}
            <div className="mt-10 w-[240px] h-[240px] rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-lg font-medium text-white/50">
                Scan to Verify
              </span>
            </div>

            {/* Close hint */}
            <p className="mt-8 text-base text-white/40">
              Tap anywhere to close
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
