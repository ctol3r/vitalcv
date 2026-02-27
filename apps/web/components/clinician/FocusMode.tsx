'use client';

import type { CredentialItem } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  FocusMode — fullscreen credential overlay                          */
/* ------------------------------------------------------------------ */

export function FocusMode({
  credential,
  onClose,
}: {
  credential: CredentialItem | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {credential && (
        <motion.div
          key="focus-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center"
          onClick={onClose}
        >
          <motion.div
            key="focus-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="max-w-lg w-full mx-auto mt-20 rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Issuer */}
            <h2 className="text-3xl font-bold text-gray-900">
              {credential.issuer}
            </h2>

            {/* Holder name */}
            <p className="text-2xl font-semibold text-gray-700 mt-2">
              {credential.holderName ?? 'Dr. Jordan Ellis'}
            </p>

            {/* Details */}
            <div className="mt-6 space-y-3 text-lg text-gray-800">
              <p>
                <span className="text-gray-500">License #:</span>{' '}
                {credential.licenseNumber ?? 'G-78432'}
              </p>
              <p>
                <span className="text-gray-500">Validity:</span>{' '}
                {credential.issueDate}
                {' → '}
                {credential.expirationDate ?? 'No expiry'}
              </p>
              <p>
                <span className="text-gray-500">NPI:</span>{' '}
                {credential.npi ?? '1003000126'}
              </p>
            </div>

            {/* QR placeholder */}
            <div className="mt-8 flex justify-center">
              <div className="w-[200px] h-[200px] rounded-xl bg-gray-200 flex items-center justify-center">
                <span className="text-lg font-medium text-gray-500">
                  Scan to Verify
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="mt-8 w-full min-h-[44px] rounded-xl bg-gray-900 text-white text-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </motion.div>

          {/* Swipe hint */}
          <p className="mt-4 text-sm text-white/60">
            Swipe down to dismiss
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
